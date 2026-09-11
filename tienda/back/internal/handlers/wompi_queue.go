package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"punto_de_venta_api/internal/db"
	"punto_de_venta_api/internal/middleware"
	"punto_de_venta_api/internal/queue"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// CreateWompiPaymentLinkWithQueue crea un payment link usando el sistema de colas
func CreateWompiPaymentLinkWithQueue(w http.ResponseWriter, r *http.Request) {
	var req WompiTransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fmt.Printf("❌ ERROR al decodificar JSON: %v\n", err)
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Datos inválidos: " + err.Error()})
		return
	}

	fmt.Printf("📦 Datos recibidos:\n")
	fmt.Printf("   AmountInCents: %d\n", req.AmountInCents)
	fmt.Printf("   Currency: %s\n", req.Currency)
	fmt.Printf("   CustomerEmail: %s\n", req.CustomerEmail)

	// Validaciones básicas
	if req.AmountInCents < 150000 {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "El monto mínimo para Payment Links de Wompi es $1,500 COP (150,000 centavos)",
		})
		return
	}
	if req.CustomerEmail == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Email del cliente es requerido"})
		return
	}
	if req.Currency == "" {
		req.Currency = "COP"
	}

	// Obtener el user_id del contexto
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		fmt.Printf("⚠️ WARNING: No se pudo obtener user_id del contexto\n")
		userID = uuid.Nil
	}
	fmt.Printf("👤 User ID: %s\n", userID)

	// Generar referencia única e idempotency key
	timestamp := time.Now().UnixMilli()
	reference := fmt.Sprintf("ORDER-%d", timestamp)
	idempotencyKey := fmt.Sprintf("idem-%s-%d", userID.String(), timestamp)
	
	fmt.Printf("🔑 Idempotency Key: %s\n", idempotencyKey)
	
	// Verificar si ya existe una venta con esta idempotency key
	var existingSaleID uuid.UUID
	err := db.Pool.QueryRow(
		context.Background(),
		`SELECT id FROM sales WHERE idempotency_key = $1`,
		idempotencyKey,
	).Scan(&existingSaleID)
	
	if err == nil {
		// Ya existe una venta con esta idempotency key
		fmt.Printf("⚠️ Solicitud duplicada detectada. Sale ID existente: %s\n", existingSaleID)
		
		// Obtener el estado de la venta
		var status string
		var paymentLinkID string
		db.Pool.QueryRow(
			context.Background(),
			`SELECT status, wompi_payment_link_id FROM sales WHERE id = $1`,
			existingSaleID,
		).Scan(&status, &paymentLinkID)
		
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success":         true,
			"sale_id":         existingSaleID,
			"status":          status,
			"reference":       reference,
			"duplicate":       true,
			"message":         "Esta solicitud ya fue procesada anteriormente",
		})
		return
	}
	
	// 1. Crear venta en BD con status PENDING
	query := `
		INSERT INTO sales (
			user_id, customer_phone, delivery_address, payment_method, 
			status, wompi_reference, idempotency_key, total_amount
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`
	
	var saleID uuid.UUID
	err = db.Pool.QueryRow(
		context.Background(),
		query,
		userID,
		req.CustomerData.PhoneNumber,
		req.ShippingAddress.AddressLine1,
		"Wompi - Procesando",
		"PENDING",
		reference,
		idempotencyKey,
		float64(req.AmountInCents) / 100.0,
	).Scan(&saleID)

	if err != nil {
		fmt.Printf("❌ ERROR al guardar venta en BD: %v\n", err)
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al crear venta"})
		return
	}

	fmt.Printf("✅ Venta creada en BD: ID=%s, Status=PENDING\n", saleID)

	// 2. Guardar los items de la venta
	for _, item := range req.Items {
		subtotal := float64(item.Quantity) * item.UnitPrice
		_, err := db.Pool.Exec(
			context.Background(),
			`INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			saleID, item.ProductID, item.ProductName, item.Quantity, item.UnitPrice, subtotal,
		)
		
		if err != nil {
			fmt.Printf("⚠️ Error al guardar item de venta: %v\n", err)
		}
	}

	// 2.5 Encolar tarea de limpieza: si en 30 minutos sigue PENDING, auto-cancelar
	cleanupDistributor := queue.GetDistributor()
	if err := cleanupDistributor.DistributeSaleCleanupTask(r.Context(), saleID); err != nil {
		// ⚠️ No bloquear la venta si falla el encolado de la tarea de limpieza
		fmt.Printf("⚠️ WARNING: No se pudo encolar tarea de cleanup para sale_id=%s: %v\n", saleID, err)
	}

	// 3. Preparar payload para la cola
	redirectURL := "http://localhost:5173/payment-result"
	if req.RedirectURL != "" {
		redirectURL = req.RedirectURL
	}

	payload := queue.WompiCreatePaymentLinkPayload{
		SaleID:          saleID,
		UserID:          userID,
		AmountInCents:   req.AmountInCents,
		Currency:        req.Currency,
		CustomerEmail:   req.CustomerEmail,
		CustomerData: queue.CustomerData{
			FullName:    req.CustomerData.FullName,
			PhoneNumber: req.CustomerData.PhoneNumber,
			LegalID:     req.CustomerData.LegalID,
			LegalIDType: req.CustomerData.LegalIDType,
		},
		ShippingAddress: queue.ShippingAddress{
			AddressLine1: req.ShippingAddress.AddressLine1,
			Country:      req.ShippingAddress.Country,
			PhoneNumber:  req.ShippingAddress.PhoneNumber,
		},
		RedirectURL:    redirectURL,
		Reference:      reference,
		IdempotencyKey: idempotencyKey,
		Items: func() []queue.SaleItem {
			items := make([]queue.SaleItem, len(req.Items))
			for i, item := range req.Items {
				items[i] = queue.SaleItem{
					ProductID:   item.ProductID,
					ProductName: item.ProductName,
					Quantity:    item.Quantity,
					UnitPrice:   item.UnitPrice,
				}
			}
			return items
		}(),
	}

	// 4. Encolar tarea para crear payment link
	distributor := queue.GetDistributor()
	
	err = distributor.DistributeWompiCreatePaymentLink(r.Context(), payload)
	if err != nil {
		fmt.Printf("❌ Error al encolar tarea: %v\n", err)
		
		// Marcar venta como fallida
		db.Pool.Exec(
			context.Background(),
			`UPDATE sales SET status = 'ERROR', payment_method = 'Error al procesar' WHERE id = $1`,
			saleID,
		)
		
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al procesar pago"})
		return
	}

	fmt.Printf("✅ Tarea encolada exitosamente: sale_id=%s\n", saleID)

	// 5. Devolver respuesta inmediata (202 Accepted)
	respondJSON(w, http.StatusAccepted, map[string]interface{}{
		"success": true,
		"sale_id": saleID,
		"status":  "processing",
		"message": "Tu pago está siendo procesado. Te notificaremos cuando esté listo.",
		"reference": reference,
		"amount_in_cents": req.AmountInCents,
		"currency": req.Currency,
	})
}

// GetSaleStatus obtiene el estado actual de una venta
func GetSaleStatus(w http.ResponseWriter, r *http.Request) {
	saleIDStr := chi.URLParam(r, "id")
	
	if saleIDStr == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "ID de venta requerido"})
		return
	}

	saleID, err := uuid.Parse(saleIDStr)
	if err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "ID de venta inválido"})
		return
	}

	// Obtener información de la venta
	var status string
	var paymentMethod string
	var paymentLinkID string
	var totalAmount float64
	
	err = db.Pool.QueryRow(
		context.Background(),
		`SELECT status, payment_method, wompi_payment_link_id, total_amount 
		 FROM sales WHERE id = $1`,
		saleID,
	).Scan(&status, &paymentMethod, &paymentLinkID, &totalAmount)
	
	if err != nil {
		fmt.Printf("❌ Error al obtener venta: %v\n", err)
		respondJSON(w, http.StatusNotFound, map[string]string{"error": "Venta no encontrada"})
		return
	}

	// Construir respuesta
	response := map[string]interface{}{
		"sale_id":        saleID,
		"status":         status,
		"payment_method": paymentMethod,
		"total_amount":   totalAmount,
	}

	// Si hay payment link, agregarlo
	if paymentLinkID != "" {
		paymentURL := fmt.Sprintf("https://checkout.wompi.co/l/%s", paymentLinkID)
		response["payment_link_id"] = paymentLinkID
		response["payment_url"] = paymentURL
	}

	// Agregar mensaje según el estado
	switch status {
	case "PENDING":
		response["message"] = "Tu pago está siendo procesado..."
	case "PAYMENT_LINK_CREATED":
		response["message"] = "Payment link creado. Redirigiendo a Wompi..."
	case "APPROVED":
		response["message"] = "¡Pago aprobado exitosamente!"
	case "DECLINED":
		response["message"] = "El pago fue rechazado"
	case "CANCELLED":
		response["message"] = "La venta fue cancelada"
	case "ERROR":
		response["message"] = "Hubo un error al procesar el pago"
	}

	respondJSON(w, http.StatusOK, response)
}
