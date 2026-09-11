package handlers

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"punto_de_venta_api/internal/db"
	"punto_de_venta_api/internal/idempotency"
	"punto_de_venta_api/internal/middleware"
	"punto_de_venta_api/internal/services"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// ─── Wompi API Configuration ─────────────────────────────────────────────────
const (
	WompiAPIURL     = "https://production.wompi.co/v1"
	WompiSandboxURL = "https://sandbox.wompi.co/v1"
	WompiWidgetURL  = "https://checkout.wompi.co/p/"
)

// ─── Wompi Merchants Response (para obtener acceptance_token) ────────────────
type WompiMerchantsResponse struct {
	Data struct {
		PresignedAcceptance struct {
			AcceptanceToken string `json:"acceptance_token"`
			Permalink       string `json:"permalink"`
			Type            string `json:"type"`
		} `json:"presigned_acceptance"`
	} `json:"data"`
}

// ─── Request/Response Structures ─────────────────────────────────────────────

type WompiTransactionRequest struct {
	AmountInCents          int64                `json:"amount_in_cents"`
	Currency               string               `json:"currency"`
	CustomerEmail          string               `json:"customer_email"`
	CustomerData           WompiCustomerData    `json:"customer_data"`
	CustomerIDNumber       string               `json:"customer_id_number"`
	ShippingAddress        WompiShippingAddress `json:"shipping_address"`
	DeliveryDepartment     *string              `json:"delivery_department"`
	DeliveryCity           *string              `json:"delivery_city"`
	DeliveryAdditionalInfo *string              `json:"delivery_additional_info"`
	RedirectURL            string               `json:"redirect_url"`
	Reference              string               `json:"reference"`
	DeliveryMethod         string               `json:"delivery_method"`
	Items                  []SaleItemRequest    `json:"items"`
}

type SaleItemRequest struct {
	ProductID   uuid.UUID `json:"product_id"`
	ProductName string    `json:"product_name"`
	Quantity    int       `json:"quantity"`
	UnitPrice   float64   `json:"unit_price"`
}

type WompiCustomerData struct {
	FullName    string `json:"full_name"`
	PhoneNumber string `json:"phone_number"`
	LegalID     string `json:"legal_id"`
	LegalIDType string `json:"legal_id_type"`
}

type WompiShippingAddress struct {
	AddressLine1 string `json:"address_line_1"`
	Country      string `json:"country"`
	PhoneNumber  string `json:"phone_number"`
}

type WompiTransactionResponse struct {
	Data struct {
		ID                string      `json:"id"`
		CreatedAt         string      `json:"created_at"`
		AmountInCents     int64       `json:"amount_in_cents"`
		Reference         string      `json:"reference"`
		Currency          string      `json:"currency"`
		PaymentMethodType string      `json:"payment_method_type"`
		RedirectURL       string      `json:"redirect_url"`
		Status            string      `json:"status"`
		StatusMessage     string      `json:"status_message"`
		ShippingAddress   interface{} `json:"shipping_address"`
		PaymentLinkID     string      `json:"payment_link_id"`
		PaymentLink       struct {
			ID  string `json:"id"`
			URL string `json:"url"`
		} `json:"payment_link"`
	} `json:"data"`
	Meta struct{} `json:"meta"`
}

type WompiPaymentLinkRequest struct {
	Name             string `json:"name"`
	Description      string `json:"description"`
	SingleUse        bool   `json:"single_use"`
	CollectsShipping bool   `json:"collects_shipping"`
	AmountInCents    int64  `json:"amount_in_cents"`
	Currency         string `json:"currency"`
	RedirectURL      string `json:"redirect_url"`
	ExpiresAt        string `json:"expires_at,omitempty"`
}

type WompiPaymentLinkResponse struct {
	Data struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		URL       string `json:"url"`
		CreatedAt string `json:"created_at"`
	} `json:"data"`
}

type WompiTransactionStatusResponse struct {
	Data struct {
		ID                string `json:"id"`
		Status            string `json:"status"`
		StatusMessage     string `json:"status_message"`
		AmountInCents     int64  `json:"amount_in_cents"`
		Currency          string `json:"currency"`
		Reference         string `json:"reference"`
		PaymentMethodType string `json:"payment_method_type"`
		PaymentMethod     struct {
			Type string `json:"type"`
		} `json:"payment_method"`
		PaymentLinkID string `json:"payment_link_id"`
		CustomerEmail string `json:"customer_email"`
		CreatedAt     string `json:"created_at"`
		FinalizedAt   string `json:"finalized_at"`
	} `json:"data"`
}

// ─── Helper: Get Acceptance Token ────────────────────────────────────────────
func getWompiAcceptanceToken(publicKey string) (string, error) {
	// Determinar URL de API
	apiURL := WompiAPIURL
	if len(publicKey) > 8 && publicKey[:8] == "pub_test" {
		apiURL = WompiSandboxURL
	}

	// Hacer petición GET a /merchants/{public_key}
	merchantsURL := fmt.Sprintf("%s/merchants/%s", apiURL, publicKey)

	fmt.Printf("🔍 Obteniendo acceptance_token desde: %s\n", merchantsURL)

	req, err := http.NewRequest("GET", merchantsURL, nil)
	if err != nil {
		return "", fmt.Errorf("error al crear request: %w", err)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("error al conectar con Wompi: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("error al leer respuesta: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("error HTTP %d: %s", resp.StatusCode, string(body))
	}

	var merchantsResp WompiMerchantsResponse
	if err := json.Unmarshal(body, &merchantsResp); err != nil {
		return "", fmt.Errorf("error al parsear respuesta: %w", err)
	}

	acceptanceToken := merchantsResp.Data.PresignedAcceptance.AcceptanceToken
	if acceptanceToken == "" {
		return "", fmt.Errorf("acceptance_token vacío en la respuesta")
	}

	fmt.Printf("✅ Acceptance token obtenido: %s\n", acceptanceToken[:20]+"...")
	return acceptanceToken, nil
}

// ─── Handler: Create Wompi Payment Link (Método Recomendado) ─────────────────
func CreateWompiPaymentLink(w http.ResponseWriter, r *http.Request) {
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

	// Obtener las credenciales de Wompi
	publicKey := os.Getenv("WOMPI_PUBLIC_KEY")
	privateKey := os.Getenv("WOMPI_PRIVATE_KEY")

	fmt.Printf("🔑 Wompi Public Key: %s\n", publicKey)
	fmt.Printf("🔑 Wompi Private Key: %s\n", privateKey[:20]+"...")

	if publicKey == "" || privateKey == "" {
		fmt.Printf("❌ ERROR: Credenciales de Wompi no configuradas\n")
		fmt.Printf("   - WOMPI_PUBLIC_KEY: %s\n", publicKey)
		fmt.Printf("   - WOMPI_PRIVATE_KEY: %s\n", privateKey)
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Wompi no está configurado"})
		return
	}

	// Obtener el user_id del contexto
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		fmt.Printf("⚠️ WARNING: No se pudo obtener user_id del contexto\n")
		userID = uuid.Nil
	}
	fmt.Printf("👤 User ID: %s\n", userID)

	// Determinar URL de API
	apiURL := WompiAPIURL
	if len(publicKey) > 8 && publicKey[:8] == "pub_test" {
		apiURL = WompiSandboxURL
	}

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

		// Obtener el payment_link_id de la venta existente
		var existingPaymentLinkID string
		db.Pool.QueryRow(
			context.Background(),
			`SELECT wompi_payment_link_id FROM sales WHERE id = $1`,
			existingSaleID,
		).Scan(&existingPaymentLinkID)

		// Devolver la respuesta con el payment link existente
		paymentURL := fmt.Sprintf("https://checkout.wompi.co/l/%s", existingPaymentLinkID)

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"success":         true,
			"payment_link_id": existingPaymentLinkID,
			"payment_url":     paymentURL,
			"reference":       reference,
			"sale_id":         existingSaleID,
			"amount_in_cents": req.AmountInCents,
			"currency":        req.Currency,
			"duplicate":       true, // Indicar que es una solicitud duplicada
		})
		return
	}

	// Crear Payment Link
	expiresAt := time.Now().Add(24 * time.Hour).Format(time.RFC3339)

	// URL de redirección más corta
	redirectURL := "http://localhost:5173/payment-result"
	if req.RedirectURL != "" {
		redirectURL = req.RedirectURL
	}

	paymentLinkPayload := map[string]interface{}{
		"name":             fmt.Sprintf("Orden %s", reference),
		"description":      fmt.Sprintf("Compra de %d productos", len(req.Items)),
		"single_use":       true,
		"collect_shipping": false,
		"amount_in_cents":  req.AmountInCents,
		"currency":         req.Currency,
		"redirect_url":     redirectURL,
		"expires_at":       expiresAt,
	}

	payloadBytes, err := json.Marshal(paymentLinkPayload)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al crear payload"})
		return
	}

	fmt.Printf("📤 Creando Payment Link en Wompi:\n%s\n", string(payloadBytes))

	// Crear la petición HTTP
	paymentLinkURL := fmt.Sprintf("%s/payment_links", apiURL)
	wompiReq, err := http.NewRequest("POST", paymentLinkURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al crear request"})
		return
	}

	// Usar la llave PRIVADA y agregar Idempotency-Key header
	wompiReq.Header.Set("Authorization", "Bearer "+privateKey)
	wompiReq.Header.Set("Content-Type", "application/json")
	wompiReq.Header.Set("Idempotency-Key", idempotencyKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(wompiReq)
	if err != nil {
		fmt.Printf("❌ ERROR al conectar con Wompi: %v\n", err)
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al conectar con Wompi"})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al leer respuesta"})
		return
	}

	fmt.Printf("📥 Respuesta de Wompi (Status %d):\n%s\n", resp.StatusCode, string(body))

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		var errorResp map[string]interface{}
		json.Unmarshal(body, &errorResp)

		respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error":       "Error al crear payment link en Wompi",
			"status":      resp.StatusCode,
			"wompi_error": errorResp,
		})
		return
	}

	var wompiResp WompiPaymentLinkResponse
	if err := json.Unmarshal(body, &wompiResp); err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al procesar respuesta"})
		return
	}

	// Guardar la venta en la base de datos
	fmt.Printf("👤 User ID (guardando venta): %d\n", userID)

	// Parsear la dirección para extraer los campos estructurados
	// Formato esperado: "Cra 4, Isnos, Huila" o "Cra 4, Isnos, Huila - info adicional"
	fullAddress := req.ShippingAddress.AddressLine1
	var streetAddress, city, department, additionalInfo string

	// Separar información adicional si existe (después de " - ")
	dashIndex := strings.Index(fullAddress, " - ")
	mainPart := fullAddress
	if dashIndex != -1 {
		mainPart = strings.TrimSpace(fullAddress[:dashIndex])
		additionalInfo = strings.TrimSpace(fullAddress[dashIndex+3:])
	}

	// Separar dirección, ciudad y departamento (separados por comas)
	parts := strings.Split(mainPart, ",")
	if len(parts) >= 3 {
		streetAddress = strings.TrimSpace(parts[0])
		city = strings.TrimSpace(parts[1])
		department = strings.TrimSpace(parts[2])
	} else if len(parts) == 2 {
		streetAddress = strings.TrimSpace(parts[0])
		city = strings.TrimSpace(parts[1])
	} else {
		streetAddress = mainPart
	}

	query := `
		INSERT INTO sales (
			user_id, customer_name, customer_email, customer_phone, customer_id_number,
			delivery_address, delivery_country, delivery_department, delivery_city, delivery_additional_info,
			payment_method, status, wompi_reference, wompi_payment_link_id, idempotency_key, total_amount
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		RETURNING id
	`

	var saleID uuid.UUID
	// Usar valores del request si existen, sino usar los parseados de la dirección
	finalDepartment := department
	if req.DeliveryDepartment != nil && *req.DeliveryDepartment != "" {
		finalDepartment = *req.DeliveryDepartment
	}
	finalCity := city
	if req.DeliveryCity != nil && *req.DeliveryCity != "" {
		finalCity = *req.DeliveryCity
	}
	finalAdditionalInfo := additionalInfo
	if req.DeliveryAdditionalInfo != nil {
		finalAdditionalInfo = *req.DeliveryAdditionalInfo
	}

	// Build payment_method storing the carrier using the en-dash format
	// so the PDF parser can split: pagoStr="Wompi"  deliveryStr="{carrier}"
	deliveryMethodStr := req.DeliveryMethod
	if deliveryMethodStr == "" {
		deliveryMethodStr = "No especificada"
	}
	paymentMethodStr := fmt.Sprintf("Wompi \u2013 %s", deliveryMethodStr) // en-dash –

	err = db.Pool.QueryRow(
		context.Background(),
		query,
		userID,
		req.CustomerData.FullName,
		req.CustomerEmail,
		req.CustomerData.PhoneNumber,
		req.CustomerIDNumber,
		streetAddress,
		"Colombia",
		finalDepartment,
		finalCity,
		finalAdditionalInfo,
		paymentMethodStr,
		"PENDING",
		reference,
		wompiResp.Data.ID,
		idempotencyKey,
		float64(req.AmountInCents)/100.0,
	).Scan(&saleID)

	if err != nil {
		fmt.Printf("❌ ERROR al guardar venta en BD: %v\n", err)
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al guardar la venta"})
		return
	}

	// Guardar los items de la venta
	for _, item := range req.Items {
		subtotal := float64(item.Quantity) * item.UnitPrice
		db.Pool.Exec(
			context.Background(),
			`INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			saleID, item.ProductID, item.ProductName, item.Quantity, item.UnitPrice, subtotal,
		)
	}

	fmt.Printf("✅ Payment Link creado exitosamente\n")
	fmt.Printf("   - Payment Link ID: %s\n", wompiResp.Data.ID)
	fmt.Printf("   - URL: %s\n", wompiResp.Data.URL)
	fmt.Printf("   - Sale ID: %s\n", saleID)

	// Construir la URL del Payment Link si Wompi no la devuelve
	paymentURL := wompiResp.Data.URL
	if paymentURL == "" {
		paymentURL = fmt.Sprintf("https://checkout.wompi.co/l/%s", wompiResp.Data.ID)
		fmt.Printf("🔧 URL construida manualmente: %s\n", paymentURL)
	}

	// Devolver la respuesta
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success":         true,
		"payment_link_id": wompiResp.Data.ID,
		"payment_url":     paymentURL,
		"reference":       reference,
		"sale_id":         saleID,
		"amount_in_cents": req.AmountInCents,
		"currency":        req.Currency,
	})
}

// ─── Handler: Create Wompi Transaction (API Directa) ─────────────────────────
func CreateWompiTransactionDirect(w http.ResponseWriter, r *http.Request) {
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
	fmt.Printf("   Items: %d productos\n", len(req.Items))

	// Validaciones básicas
	if req.AmountInCents <= 0 {
		fmt.Printf("❌ ERROR: Monto inválido: %d\n", req.AmountInCents)
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "El monto debe ser mayor a 0"})
		return
	}
	if req.CustomerEmail == "" {
		fmt.Printf("❌ ERROR: Email vacío\n")
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Email del cliente es requerido"})
		return
	}
	if req.Currency == "" {
		req.Currency = "COP"
	}

	// Obtener las credenciales de Wompi
	publicKey := os.Getenv("WOMPI_PUBLIC_KEY")
	privateKey := os.Getenv("WOMPI_PRIVATE_KEY")

	fmt.Printf("🔑 Wompi Public Key: %s\n", publicKey[:20]+"...")
	fmt.Printf("🔑 Wompi Private Key: %s\n", privateKey[:20]+"...")

	if publicKey == "" || privateKey == "" {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Wompi no está configurado en el servidor"})
		return
	}

	// Determinar URL de API
	apiURL := WompiAPIURL
	if len(publicKey) > 8 && publicKey[:8] == "pub_test" {
		apiURL = WompiSandboxURL
	}

	// Generar referencia única
	reference := fmt.Sprintf("ORDER-%d", time.Now().UnixMilli())

	// PASO 1: Usar los tokens de aceptación de Wompi (hardcoded desde el dashboard)
	acceptanceToken := "eyJhbGciOiJIUzI1NiJ9.eyJjb250cmFjdF9pZCI6NDcyLCJwZXJtYWxpbmsiOiJodHRwczovL3dvbXBpLmNvbS9hc3NldHMvZG93bmxvYWRibGUvcmVnbGFtZW50by1Vc3Vhcmlvcy1Db2xvbWJpYS5wZGYiLCJmaWxlX2hhc2giOiJkYzJkNGUzMDVlNGQzNmFhYjhjYzU3N2I1YTY5Nzg1MSIsImppdCI6IjE3NzgwMzE4OTktMTE4MTkiLCJlbWFpbCI6IiIsImV4cCI6MTc3ODAzNTQ5OX0.UmGX7vUUvugCFoa6Cpc6T6IHT8RipC5PRJrZqReWGSI"
	personalDataAuthToken := "eyJhbGciOiJIUzI1NiJ9.eyJjb250cmFjdF9pZCI6NDM5LCJwZXJtYWxpbmsiOiJodHRwczovL3dvbXBpLmNvbS9hc3NldHMvZG93bmxvYWRibGUvYXV0b3JpemFjaW9uLXRyYXRhbWllbnRvLWRhdG9zLXBlcnNvbmFsZXMucGRmIiwiZmlsZV9oYXNoIjoiNTE2ODYzZjA3NzZlZWY3NjBkNGI5OWFiMWJlZjRjNzgiLCJqaXQiOiIxNzc4MDMxODk5LTEyNzc1IiwiZW1haWwiOiIifQ.8m3EciaKuffWyiM-kIn5ZIo97l0LTegpoDnzUJM8ya4"

	fmt.Printf("✅ Usando acceptance_token hardcoded\n")
	fmt.Printf("✅ Usando personal_data_auth_token hardcoded\n")

	// PASO 2: Crear la transacción con la API directa
	// IMPORTANTE: Para crear una transacción directa, Wompi requiere un payment_link
	// en lugar de especificar el método de pago directamente
	transactionPayload := map[string]interface{}{
		"acceptance_token":         acceptanceToken,
		"personal_data_auth_token": personalDataAuthToken,
		"amount_in_cents":          req.AmountInCents,
		"currency":                 req.Currency,
		"customer_email":           req.CustomerEmail,
		"reference":                reference,
		"customer_data": map[string]string{
			"phone_number": req.CustomerData.PhoneNumber,
			"full_name":    req.CustomerData.FullName,
		},
		// Agregar payment_method para indicar que se usará el checkout
		"payment_method": map[string]interface{}{
			"type": "CARD", // Tipo por defecto, el usuario elegirá en el checkout
		},
	}

	// Agregar dirección de envío si está presente
	if req.ShippingAddress.AddressLine1 != "" {
		transactionPayload["shipping_address"] = map[string]string{
			"address_line_1": req.ShippingAddress.AddressLine1,
			"country":        req.ShippingAddress.Country,
			"phone_number":   req.ShippingAddress.PhoneNumber,
		}
	}

	// Agregar redirect_url si está presente
	if req.RedirectURL != "" {
		transactionPayload["redirect_url"] = req.RedirectURL
	}

	payloadBytes, err := json.Marshal(transactionPayload)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al crear payload"})
		return
	}

	fmt.Printf("📤 Enviando transacción a Wompi:\n%s\n", string(payloadBytes))

	// Crear la petición HTTP
	transactionURL := fmt.Sprintf("%s/transactions", apiURL)
	wompiReq, err := http.NewRequest("POST", transactionURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al crear request"})
		return
	}

	// IMPORTANTE: Usar la llave PRIVADA para crear transacciones
	wompiReq.Header.Set("Authorization", "Bearer "+privateKey)
	wompiReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(wompiReq)
	if err != nil {
		fmt.Printf("❌ ERROR al conectar con Wompi: %v\n", err)
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al conectar con Wompi"})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al leer respuesta"})
		return
	}

	fmt.Printf("📥 Respuesta de Wompi (Status %d):\n%s\n", resp.StatusCode, string(body))

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		// Parsear el error de Wompi para más detalles
		var errorResp map[string]interface{}
		json.Unmarshal(body, &errorResp)

		fmt.Printf("❌ ERROR COMPLETO DE WOMPI:\n")
		fmt.Printf("   Status Code: %d\n", resp.StatusCode)
		fmt.Printf("   Response Body: %s\n", string(body))
		fmt.Printf("   Headers: %+v\n", resp.Header)

		respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error":       "Error al crear transacción en Wompi",
			"status":      resp.StatusCode,
			"wompi_error": errorResp,
			"details":     string(body),
		})
		return
	}

	var wompiResp WompiTransactionResponse
	if err := json.Unmarshal(body, &wompiResp); err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al procesar respuesta"})
		return
	}

	// Guardar la transacción en la base de datos
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		fmt.Printf("⚠️ WARNING: No se pudo obtener user_id del contexto\n")
		userID = uuid.Nil
	}

	fmt.Printf("👤 User ID: %s\n", userID)

	query := `
		INSERT INTO sales (
			user_id, customer_phone, delivery_address, payment_method, 
			status, wompi_reference, wompi_transaction_id, total_amount
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`

	deliveryMethodStr := req.DeliveryMethod
	if deliveryMethodStr == "" {
		deliveryMethodStr = "No especificada"
	}
	paymentMethodStr := fmt.Sprintf("Wompi \u2013 %s", deliveryMethodStr)

	var saleID uuid.UUID
	err = db.Pool.QueryRow(
		context.Background(),
		query,
		userID,
		req.CustomerData.PhoneNumber,
		req.ShippingAddress.AddressLine1,
		paymentMethodStr,
		"PENDING",
		reference,
		wompiResp.Data.ID,
		float64(req.AmountInCents)/100.0,
	).Scan(&saleID)

	if err != nil {
		fmt.Printf("❌ ERROR al guardar venta en BD: %v\n", err)
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al guardar la venta: " + err.Error()})
		return
	}

	fmt.Printf("✅ Venta guardada exitosamente. ID: %s\n", saleID)

	// Guardar los items de la venta
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

	fmt.Printf("✅ Transacción creada exitosamente en Wompi\n")
	fmt.Printf("📊 Detalles:\n")
	fmt.Printf("   - Transaction ID: %s\n", wompiResp.Data.ID)
	fmt.Printf("   - Sale ID: %s\n", saleID)
	fmt.Printf("   - Reference: %s\n", reference)
	fmt.Printf("   - Status: %s\n", wompiResp.Data.Status)

	// Devolver la respuesta completa
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success":         true,
		"transaction_id":  wompiResp.Data.ID,
		"reference":       reference,
		"sale_id":         saleID,
		"amount_in_cents": req.AmountInCents,
		"currency":        req.Currency,
		"status":          wompiResp.Data.Status,
		"payment_link":    wompiResp.Data.PaymentLink.URL,
	})
}

// ─── Handler: Create Wompi Transaction (Widget - Método Original) ────────────
func CreateWompiTransaction(w http.ResponseWriter, r *http.Request) {
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
	fmt.Printf("   Items: %d productos\n", len(req.Items))

	// Validaciones básicas
	if req.AmountInCents <= 0 {
		fmt.Printf("❌ ERROR: Monto inválido: %d\n", req.AmountInCents)
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "El monto debe ser mayor a 0"})
		return
	}
	if req.CustomerEmail == "" {
		fmt.Printf("❌ ERROR: Email vacío\n")
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Email del cliente es requerido"})
		return
	}
	if req.Currency == "" {
		req.Currency = "COP"
	}

	// Obtener las credenciales de Wompi
	publicKey := os.Getenv("WOMPI_PUBLIC_KEY")
	integritySecret := os.Getenv("WOMPI_INTEGRITY_SECRET")

	fmt.Printf("🔑 Wompi Public Key: %s\n", publicKey[:20]+"...")

	if publicKey == "" || integritySecret == "" {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Wompi no está configurado en el servidor"})
		return
	}

	// Generar referencia única
	reference := fmt.Sprintf("ORDER-%d", time.Now().UnixMilli())

	// Generar firma de integridad según documentación de Wompi
	// Formato: "<reference><amount_in_cents><currency><integrity_secret>"
	integrityString := fmt.Sprintf("%s%d%s%s", reference, req.AmountInCents, req.Currency, integritySecret)
	hash := sha256.Sum256([]byte(integrityString))
	integritySignature := hex.EncodeToString(hash[:])

	fmt.Printf("🔐 Integrity signature generada: %s\n", integritySignature[:20]+"...")

	// Guardar la transacción pendiente en la base de datos PRIMERO
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		fmt.Printf("⚠️ WARNING: No se pudo obtener user_id del contexto\n")
		userID = uuid.Nil
	}

	fmt.Printf("👤 User ID: %s\n", userID)

	query := `
		INSERT INTO sales (
			user_id, customer_phone, delivery_address, payment_method, 
			status, wompi_reference, total_amount
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`

	deliveryMethodStr := req.DeliveryMethod
	if deliveryMethodStr == "" {
		deliveryMethodStr = "No especificada"
	}
	paymentMethodStr := fmt.Sprintf("Wompi \u2013 %s", deliveryMethodStr)

	var saleID uuid.UUID
	err := db.Pool.QueryRow(
		context.Background(),
		query,
		userID,
		req.CustomerData.PhoneNumber,
		req.ShippingAddress.AddressLine1,
		paymentMethodStr,
		"PENDING",
		reference,
		float64(req.AmountInCents)/100.0,
	).Scan(&saleID)

	if err != nil {
		fmt.Printf("❌ ERROR al guardar venta en BD: %v\n", err)
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al guardar la venta: " + err.Error()})
		return
	}

	fmt.Printf("✅ Venta guardada exitosamente. ID: %s\n", saleID)

	// Guardar los items de la venta
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

	fmt.Printf("✅ Transacción creada exitosamente\n")
	fmt.Printf("📊 Detalles:\n")
	fmt.Printf("   - Sale ID: %s\n", saleID)
	fmt.Printf("   - Reference: %s\n", reference)
	fmt.Printf("   - Amount: %d centavos\n", req.AmountInCents)
	fmt.Printf("   - Integrity Signature: %s\n", integritySignature[:20]+"...")

	// Devolver la referencia y firma para que el frontend use el Widget
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success":             true,
		"reference":           reference,
		"integrity_signature": integritySignature,
		"public_key":          publicKey,
		"sale_id":             saleID,
		"amount_in_cents":     req.AmountInCents,
		"currency":            req.Currency,
		"customer_email":      req.CustomerEmail,
	})
}

// ─── Handler: Verify Wompi Transaction ───────────────────────────────────────
// Este endpoint DEBE ser llamado por el frontend antes de mostrar "pago exitoso"
// Consulta el estado REAL en Wompi y actualiza la BD solo si el pago fue aprobado
func VerifyWompiTransaction(w http.ResponseWriter, r *http.Request) {
	transactionID := chi.URLParam(r, "id")

	if transactionID == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "ID de transacción requerido"})
		return
	}

	publicKey := os.Getenv("WOMPI_PUBLIC_KEY")
	privateKey := os.Getenv("WOMPI_PRIVATE_KEY")

	if publicKey == "" || privateKey == "" {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Wompi no está configurado"})
		return
	}

	// Determinar URL de API
	apiURL := WompiAPIURL
	if len(publicKey) > 8 && publicKey[:8] == "pub_test" {
		apiURL = WompiSandboxURL
	}

	fmt.Printf("🔍 Verificando transacción: %s\n", transactionID)
	fmt.Printf("   API URL: %s\n", apiURL)

	// Consultar el estado en Wompi
	wompiReq, err := http.NewRequest("GET", apiURL+"/transactions/"+transactionID, nil)
	if err != nil {
		fmt.Printf("❌ Error al crear solicitud: %v\n", err)
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al crear solicitud"})
		return
	}

	// IMPORTANTE: Usar la llave PRIVADA para consultar transacciones
	wompiReq.Header.Set("Authorization", "Bearer "+privateKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(wompiReq)
	if err != nil {
		fmt.Printf("❌ Error al conectar con Wompi: %v\n", err)
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al conectar con Wompi"})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("❌ Error al leer respuesta: %v\n", err)
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al leer respuesta"})
		return
	}

	fmt.Printf("📥 Respuesta de Wompi (Status %d):\n%s\n", resp.StatusCode, string(body))

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("❌ Error HTTP %d al verificar transacción\n", resp.StatusCode)
		respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error":       "Error al verificar transacción",
			"status_code": resp.StatusCode,
			"details":     string(body),
		})
		return
	}

	var wompiResp WompiTransactionStatusResponse
	if err := json.Unmarshal(body, &wompiResp); err != nil {
		fmt.Printf("❌ Error al parsear respuesta: %v\n", err)
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al procesar respuesta"})
		return
	}

	fmt.Printf("✅ Transacción verificada:\n")
	fmt.Printf("   - ID: %s\n", wompiResp.Data.ID)
	fmt.Printf("   - Status: %s\n", wompiResp.Data.Status)
	fmt.Printf("   - Status Message: %s\n", wompiResp.Data.StatusMessage)
	fmt.Printf("   - Amount: %d centavos\n", wompiResp.Data.AmountInCents)
	fmt.Printf("   - Reference: %s\n", wompiResp.Data.Reference)

	// PASO 1: Verificar idempotencia con Redis
	idempotencyKey := fmt.Sprintf("verify:wompi:%s", transactionID)

	fmt.Printf("🔑 VERIFY: Verificando idempotencia con key: %s\n", idempotencyKey)

	// Intentar obtener respuesta cacheada
	cachedResponse, found, err := checkIdempotency(r.Context(), idempotencyKey)
	if err != nil {
		fmt.Printf("⚠️ VERIFY: Error al verificar idempotencia: %v\n", err)
		// Continuar sin idempotencia si Redis falla
	} else if found {
		fmt.Printf("✅ VERIFY: Petición duplicada detectada (idempotency key: %s). Retornando respuesta cacheada.\n", idempotencyKey)
		respondJSON(w, cachedResponse.StatusCode, cachedResponse.Body)
		return
	}

	fmt.Printf("🔄 VERIFY: No hay respuesta cacheada, procesando petición...\n")

	// PASO 2: Procesar según el estado de Wompi
	var responseBody map[string]interface{}
	var statusCode int

	switch wompiResp.Data.Status {
	case "APPROVED":
		fmt.Printf("✅ Pago APROBADO\n")
		fmt.Printf("📋 Datos de la transacción:\n")
		fmt.Printf("   - Transaction ID: %s\n", transactionID)
		fmt.Printf("   - Payment Link ID: %s\n", wompiResp.Data.PaymentLinkID)
		fmt.Printf("   - Reference: %s\n", wompiResp.Data.Reference)
		fmt.Printf("   - Amount: %d centavos\n", wompiResp.Data.AmountInCents)

		// Extraer el tipo de método de pago de forma segura
		pmType := wompiResp.Data.PaymentMethodType
		if pmType == "" && wompiResp.Data.PaymentMethod.Type != "" {
			pmType = wompiResp.Data.PaymentMethod.Type
		}

		// Usar el servicio de pagos para procesar la aprobación
		fmt.Printf("🔄 VERIFY: Llamando a processPaymentApproval con pmType=%s...\n", pmType)
		result, err := processPaymentApproval(
			r.Context(),
			transactionID,
			wompiResp.Data.PaymentLinkID,
			wompiResp.Data.Reference,
			wompiResp.Data.AmountInCents,
			pmType,
		)

		if err != nil {
			fmt.Printf("❌ VERIFY: Error al procesar aprobación: %v\n", err)
			fmt.Printf("❌ VERIFY: Tipo de error: %T\n", err)
			fmt.Printf("❌ VERIFY: Mensaje de error: %s\n", err.Error())

			// Si no se encuentra la venta, devolver un error más específico
			// pero con status 200 para que el frontend pueda manejarlo
			if err.Error() == "venta no encontrada" || err.Error() == fmt.Sprintf("venta no encontrada para transacción %s", transactionID) {
				statusCode = http.StatusOK
				responseBody = map[string]interface{}{
					"status":         wompiResp.Data.Status,
					"status_message": wompiResp.Data.StatusMessage,
					"amount":         wompiResp.Data.AmountInCents,
					"currency":       wompiResp.Data.Currency,
					"reference":      wompiResp.Data.Reference,
					"payment_method": wompiResp.Data.PaymentMethodType,
					"created_at":     wompiResp.Data.CreatedAt,
					"finalized_at":   wompiResp.Data.FinalizedAt,
					"warning":        "Pago aprobado en Wompi pero no se encontró la venta en la base de datos",
					"sale_id":        0,
					"stock_reduced":  false,
					"already_paid":   false,
				}
			} else {
				statusCode = http.StatusInternalServerError
				responseBody = map[string]interface{}{
					"error":          "Error al procesar pago",
					"details":        err.Error(),
					"status":         wompiResp.Data.Status,
					"status_message": wompiResp.Data.StatusMessage,
				}
			}
		} else {
			statusCode = http.StatusOK
			responseBody = map[string]interface{}{
				"status":         wompiResp.Data.Status,
				"status_message": wompiResp.Data.StatusMessage,
				"amount":         wompiResp.Data.AmountInCents,
				"currency":       wompiResp.Data.Currency,
				"reference":      wompiResp.Data.Reference,
				"payment_method": wompiResp.Data.PaymentMethodType,
				"created_at":     wompiResp.Data.CreatedAt,
				"finalized_at":   wompiResp.Data.FinalizedAt,
				"sale_id":        result.SaleID,
				"stock_reduced":  result.StockReduced,
				"already_paid":   result.AlreadyPaid,
			}
		}

	case "DECLINED":
		fmt.Printf("❌ Pago RECHAZADO\n")
		err := processPaymentDecline(r.Context(), transactionID, wompiResp.Data.PaymentLinkID, wompiResp.Data.Reference)

		if err != nil {
			fmt.Printf("❌ VERIFY: Error al procesar rechazo: %v\n", err)
		}

		statusCode = http.StatusOK
		responseBody = map[string]interface{}{
			"status":         wompiResp.Data.Status,
			"status_message": wompiResp.Data.StatusMessage,
			"amount":         wompiResp.Data.AmountInCents,
			"currency":       wompiResp.Data.Currency,
			"reference":      wompiResp.Data.Reference,
			"payment_method": wompiResp.Data.PaymentMethodType,
			"created_at":     wompiResp.Data.CreatedAt,
			"finalized_at":   wompiResp.Data.FinalizedAt,
		}

	case "VOIDED":
		fmt.Printf("🚫 Pago CANCELADO\n")
		err := processPaymentVoid(r.Context(), transactionID, wompiResp.Data.PaymentLinkID, wompiResp.Data.Reference)

		if err != nil {
			fmt.Printf("❌ VERIFY: Error al procesar cancelación: %v\n", err)
		}

		statusCode = http.StatusOK
		responseBody = map[string]interface{}{
			"status":         wompiResp.Data.Status,
			"status_message": wompiResp.Data.StatusMessage,
			"amount":         wompiResp.Data.AmountInCents,
			"currency":       wompiResp.Data.Currency,
			"reference":      wompiResp.Data.Reference,
			"payment_method": wompiResp.Data.PaymentMethodType,
			"created_at":     wompiResp.Data.CreatedAt,
			"finalized_at":   wompiResp.Data.FinalizedAt,
		}

	case "ERROR":
		fmt.Printf("💥 Pago con ERROR\n")
		statusCode = http.StatusOK
		responseBody = map[string]interface{}{
			"status":         wompiResp.Data.Status,
			"status_message": wompiResp.Data.StatusMessage,
			"amount":         wompiResp.Data.AmountInCents,
			"currency":       wompiResp.Data.Currency,
			"reference":      wompiResp.Data.Reference,
			"payment_method": wompiResp.Data.PaymentMethodType,
			"created_at":     wompiResp.Data.CreatedAt,
			"finalized_at":   wompiResp.Data.FinalizedAt,
		}

	default:
		fmt.Printf("⏳ Pago PENDIENTE o estado desconocido: %s\n", wompiResp.Data.Status)
		statusCode = http.StatusOK
		responseBody = map[string]interface{}{
			"status":         wompiResp.Data.Status,
			"status_message": wompiResp.Data.StatusMessage,
			"amount":         wompiResp.Data.AmountInCents,
			"currency":       wompiResp.Data.Currency,
			"reference":      wompiResp.Data.Reference,
			"payment_method": wompiResp.Data.PaymentMethodType,
			"created_at":     wompiResp.Data.CreatedAt,
			"finalized_at":   wompiResp.Data.FinalizedAt,
		}
	}

	// PASO 3: Guardar la respuesta en Redis para idempotencia (TTL: 24 horas)
	if err := saveIdempotency(r.Context(), idempotencyKey, statusCode, responseBody, 24*time.Hour); err != nil {
		fmt.Printf("⚠️ VERIFY: Error al guardar idempotencia: %v\n", err)
		// No fallar la petición si Redis falla
	}

	// PASO 4: Responder
	respondJSON(w, statusCode, responseBody)
}

// ─── Handler: Wompi Webhook (para recibir notificaciones) ───────────────────
func WompiWebhook(w http.ResponseWriter, r *http.Request) {
	var payload map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		fmt.Printf("❌ WEBHOOK: Error al decodificar payload: %v\n", err)
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Payload inválido"})
		return
	}

	fmt.Printf("📥 WEBHOOK: Recibido evento de Wompi:\n%s\n", func() string {
		b, _ := json.MarshalIndent(payload, "", "  ")
		return string(b)
	}())

	// Validar la firma del webhook usando WOMPI_EVENTS_SECRET
	// TODO: Implementar validación de firma para producción

	event, ok := payload["event"].(string)
	if !ok {
		fmt.Printf("❌ WEBHOOK: Evento no especificado\n")
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Evento no especificado"})
		return
	}

	data, ok := payload["data"].(map[string]interface{})
	if !ok {
		fmt.Printf("❌ WEBHOOK: Datos del evento inválidos\n")
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Datos del evento inválidos"})
		return
	}

	// Si Wompi envía los datos dentro de "transaction"
	if transaction, ok := data["transaction"].(map[string]interface{}); ok {
		data = transaction
	}

	transactionID, _ := data["id"].(string)
	status, _ := data["status"].(string)
	reference, _ := data["reference"].(string)
	paymentLinkID, _ := data["payment_link_id"].(string)

	if transactionID == "" || status == "" {
		fmt.Printf("❌ WEBHOOK: Datos incompletos - ID: %s, Status: %s\n", transactionID, status)
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Datos incompletos"})
		return
	}

	fmt.Printf("🔄 WEBHOOK: Procesando evento '%s' para transacción %s (Status: %s)\n", event, transactionID, status)

	// PASO 1: Verificar idempotencia con Redis
	idempotencyKey := fmt.Sprintf("webhook:wompi:%s", transactionID)

	// Intentar obtener respuesta cacheada
	cachedResponse, found, err := checkIdempotency(r.Context(), idempotencyKey)
	if err != nil {
		fmt.Printf("⚠️ WEBHOOK: Error al verificar idempotencia: %v\n", err)
		// Continuar sin idempotencia si Redis falla
	} else if found {
		fmt.Printf("✅ WEBHOOK: Petición duplicada detectada (idempotency key: %s). Retornando respuesta cacheada.\n", idempotencyKey)
		respondJSON(w, cachedResponse.StatusCode, cachedResponse.Body)
		return
	}

	// PASO 2: Procesar el evento según el tipo
	var responseBody map[string]interface{}
	var statusCode int

	switch event {
	case "transaction.updated":
		paymentMethodType, _ := data["payment_method_type"].(string)
		if paymentMethodType == "" {
			if pm, ok := data["payment_method"].(map[string]interface{}); ok {
				paymentMethodType, _ = pm["type"].(string)
			}
		}

		amountInCents, _ := data["amount_in_cents"].(float64)

		switch status {
		case "APPROVED":
			fmt.Printf("✅ WEBHOOK: Pago aprobado\n")

			// Usar el servicio de pagos para procesar la aprobación
			result, err := processPaymentApproval(r.Context(), transactionID, paymentLinkID, reference, int64(amountInCents), paymentMethodType)

			if err != nil {
				fmt.Printf("❌ WEBHOOK: Error al procesar aprobación: %v\n", err)
				statusCode = http.StatusInternalServerError
				responseBody = map[string]interface{}{
					"success": false,
					"error":   err.Error(),
				}
			} else {
				statusCode = http.StatusOK
				responseBody = map[string]interface{}{
					"success":        true,
					"message":        "Pago aprobado y procesado",
					"event":          event,
					"transaction_id": transactionID,
					"status":         status,
					"sale_id":        result.SaleID,
					"stock_reduced":  result.StockReduced,
					"already_paid":   result.AlreadyPaid,
				}
			}

		case "DECLINED":
			fmt.Printf("❌ WEBHOOK: Pago rechazado\n")
			err := processPaymentDecline(r.Context(), transactionID, paymentLinkID, reference)

			if err != nil {
				fmt.Printf("❌ WEBHOOK: Error al procesar rechazo: %v\n", err)
				statusCode = http.StatusInternalServerError
				responseBody = map[string]interface{}{
					"success": false,
					"error":   err.Error(),
				}
			} else {
				statusCode = http.StatusOK
				responseBody = map[string]interface{}{
					"success":        true,
					"message":        "Pago rechazado",
					"event":          event,
					"transaction_id": transactionID,
					"status":         status,
				}
			}

		case "VOIDED":
			fmt.Printf("🚫 WEBHOOK: Pago cancelado\n")
			err := processPaymentVoid(r.Context(), transactionID, paymentLinkID, reference)

			if err != nil {
				fmt.Printf("❌ WEBHOOK: Error al procesar cancelación: %v\n", err)
				statusCode = http.StatusInternalServerError
				responseBody = map[string]interface{}{
					"success": false,
					"error":   err.Error(),
				}
			} else {
				statusCode = http.StatusOK
				responseBody = map[string]interface{}{
					"success":        true,
					"message":        "Pago cancelado",
					"event":          event,
					"transaction_id": transactionID,
					"status":         status,
				}
			}

		case "ERROR":
			fmt.Printf("💥 WEBHOOK: Error en el pago\n")
			statusCode = http.StatusOK
			responseBody = map[string]interface{}{
				"success":        true,
				"message":        "Error en el pago",
				"event":          event,
				"transaction_id": transactionID,
				"status":         status,
			}

		default:
			fmt.Printf("⚠️ WEBHOOK: Estado desconocido: %s\n", status)
			statusCode = http.StatusOK
			responseBody = map[string]interface{}{
				"success":        true,
				"message":        "Estado desconocido",
				"event":          event,
				"transaction_id": transactionID,
				"status":         status,
			}
		}

	default:
		fmt.Printf("⚠️ WEBHOOK: Evento no manejado: %s\n", event)
		statusCode = http.StatusOK
		responseBody = map[string]interface{}{
			"success": true,
			"message": "Evento no manejado",
			"event":   event,
		}
	}

	// PASO 3: Guardar la respuesta en Redis para idempotencia (TTL: 24 horas)
	if err := saveIdempotency(r.Context(), idempotencyKey, statusCode, responseBody, 24*time.Hour); err != nil {
		fmt.Printf("⚠️ WEBHOOK: Error al guardar idempotencia: %v\n", err)
		// No fallar la petición si Redis falla
	}

	// PASO 4: Responder a Wompi
	respondJSON(w, statusCode, responseBody)
}

// ─── Helper function ──────────────────────────────────────────────────────────
func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// ─── Funciones auxiliares para idempotencia ──────────────────────────────────

// checkIdempotency verifica si una petición ya fue procesada
func checkIdempotency(ctx context.Context, key string) (*idempotency.IdempotencyResponse, bool, error) {
	return idempotency.CheckIdempotency(ctx, key)
}

// saveIdempotency guarda la respuesta de una petición en Redis
func saveIdempotency(ctx context.Context, key string, statusCode int, body map[string]interface{}, ttl time.Duration) error {
	return idempotency.SaveIdempotency(ctx, key, statusCode, body, ttl)
}

// ─── Funciones auxiliares para procesamiento de pagos ────────────────────────

// processPaymentApproval procesa la aprobación de un pago
func processPaymentApproval(ctx context.Context, transactionID, paymentLinkID, reference string, amountInCents int64, paymentMethodType string) (*services.PaymentResult, error) {
	return services.ProcessPaymentApproval(ctx, transactionID, paymentLinkID, reference, amountInCents, paymentMethodType)
}

// processPaymentDecline procesa el rechazo de un pago
func processPaymentDecline(ctx context.Context, transactionID, paymentLinkID, reference string) error {
	return services.ProcessPaymentDecline(ctx, transactionID, paymentLinkID, reference)
}

// processPaymentVoid procesa la cancelación de un pago
func processPaymentVoid(ctx context.Context, transactionID, paymentLinkID, reference string) error {
	return services.ProcessPaymentVoid(ctx, transactionID, paymentLinkID, reference)
}

// ─── Handler: Test Wompi Payment Link (Sin Autenticación) ────────────────────
func TestWompiPaymentLink(w http.ResponseWriter, r *http.Request) {
	var req WompiTransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fmt.Printf("❌ ERROR al decodificar JSON: %v\n", err)
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Datos inválidos: " + err.Error()})
		return
	}

	fmt.Printf("🧪 TEST - Datos recibidos:\n")
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

	// Obtener las credenciales de Wompi
	publicKey := os.Getenv("WOMPI_PUBLIC_KEY")
	privateKey := os.Getenv("WOMPI_PRIVATE_KEY")

	fmt.Printf("🔑 Wompi Public Key: %s\n", publicKey)
	fmt.Printf("🔑 Wompi Private Key: %s\n", privateKey[:20]+"...")

	if publicKey == "" || privateKey == "" {
		fmt.Printf("❌ ERROR: Credenciales de Wompi no configuradas\n")
		fmt.Printf("   - WOMPI_PUBLIC_KEY: %s\n", publicKey)
		fmt.Printf("   - WOMPI_PRIVATE_KEY: %s\n", privateKey)
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Wompi no está configurado"})
		return
	}

	// Determinar URL de API
	apiURL := WompiAPIURL
	if len(publicKey) > 8 && publicKey[:8] == "pub_test" {
		apiURL = WompiSandboxURL
	}

	// Generar referencia única
	reference := fmt.Sprintf("TEST-ORDER-%d", time.Now().UnixMilli())

	// Crear Payment Link
	expiresAt := time.Now().Add(24 * time.Hour).Format(time.RFC3339)

	// URL de redirección
	redirectURL := "http://localhost:5173/payment-result"
	if req.RedirectURL != "" {
		redirectURL = req.RedirectURL
	}

	paymentLinkPayload := map[string]interface{}{
		"name":             fmt.Sprintf("Test Orden %s", reference),
		"description":      fmt.Sprintf("Prueba de compra de %d productos", len(req.Items)),
		"single_use":       true,
		"collect_shipping": false,
		"amount_in_cents":  req.AmountInCents,
		"currency":         req.Currency,
		"redirect_url":     redirectURL,
		"expires_at":       expiresAt,
	}

	payloadBytes, err := json.Marshal(paymentLinkPayload)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al crear payload"})
		return
	}

	fmt.Printf("📤 TEST - Creando Payment Link en Wompi:\n%s\n", string(payloadBytes))

	// Crear la petición HTTP
	paymentLinkURL := fmt.Sprintf("%s/payment_links", apiURL)
	wompiReq, err := http.NewRequest("POST", paymentLinkURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al crear request"})
		return
	}

	// Usar la llave PRIVADA
	wompiReq.Header.Set("Authorization", "Bearer "+privateKey)
	wompiReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(wompiReq)
	if err != nil {
		fmt.Printf("❌ ERROR al conectar con Wompi: %v\n", err)
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al conectar con Wompi"})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al leer respuesta"})
		return
	}

	fmt.Printf("📥 TEST - Respuesta de Wompi (Status %d):\n%s\n", string(body))

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		var errorResp map[string]interface{}
		json.Unmarshal(body, &errorResp)

		respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error":       "Error al crear payment link en Wompi",
			"status":      resp.StatusCode,
			"wompi_error": errorResp,
		})
		return
	}

	var wompiResp WompiPaymentLinkResponse
	if err := json.Unmarshal(body, &wompiResp); err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error al procesar respuesta"})
		return
	}

	fmt.Printf("✅ TEST - Payment Link creado exitosamente\n")
	fmt.Printf("   - Payment Link ID: %s\n", wompiResp.Data.ID)
	fmt.Printf("   - URL: %s\n", wompiResp.Data.URL)

	// Construir la URL del Payment Link si Wompi no la devuelve
	paymentURL := wompiResp.Data.URL
	if paymentURL == "" {
		paymentURL = fmt.Sprintf("https://checkout.wompi.co/l/%s", wompiResp.Data.ID)
		fmt.Printf("🔧 TEST - URL construida manualmente: %s\n", paymentURL)
	}

	// Devolver la respuesta (sin guardar en BD para pruebas)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success":         true,
		"payment_link_id": wompiResp.Data.ID,
		"payment_url":     paymentURL,
		"reference":       reference,
		"amount_in_cents": req.AmountInCents,
		"currency":        req.Currency,
		"test_mode":       true,
	})
}

// ─── Handler: Pay Existing Sale ──────────────────────────────────────────────
func PayExistingSale(w http.ResponseWriter, r *http.Request) {
	saleIDStr := chi.URLParam(r, "id")
	saleID, err := uuid.Parse(saleIDStr)
	if err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "ID de pedido inválido"})
		return
	}

	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		respondJSON(w, http.StatusUnauthorized, map[string]string{"error": "No autorizado"})
		return
	}

	var wompiPaymentLinkID *string
	var status string
	var saleUserID *uuid.UUID

	err = db.Pool.QueryRow(
		context.Background(),
		`SELECT wompi_payment_link_id, status, user_id FROM sales WHERE id = $1`,
		saleID,
	).Scan(&wompiPaymentLinkID, &status, &saleUserID)

	if err != nil {
		respondJSON(w, http.StatusNotFound, map[string]string{"error": "Pedido no encontrado"})
		return
	}

	if saleUserID != nil && *saleUserID != userID {
		respondJSON(w, http.StatusForbidden, map[string]string{"error": "No tienes permiso para pagar este pedido"})
		return
	}

	if status != "PENDIENTE" && status != "PENDING" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "El pedido ya no está pendiente o ya expiró"})
		return
	}

	if wompiPaymentLinkID == nil || *wompiPaymentLinkID == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Este pedido no tiene un enlace de pago Wompi asociado. Por favor contacte soporte."})
		return
	}

	paymentURL := fmt.Sprintf("https://checkout.wompi.co/l/%s", *wompiPaymentLinkID)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success":  true,
		"url_pago": paymentURL,
	})
}
