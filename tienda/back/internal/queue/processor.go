package queue

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"punto_de_venta_api/internal/db"
	"time"

	"github.com/hibiken/asynq"
)

// TaskProcessor procesa las tareas de la cola
type TaskProcessor interface {
	Start() error
	Stop()
	ProcessWompiCreatePaymentLink(ctx context.Context, task *asynq.Task) error
	ProcessWompiVerifyPayment(ctx context.Context, task *asynq.Task) error
	ProcessWompiWebhook(ctx context.Context, task *asynq.Task) error
	ProcessReduceStock(ctx context.Context, task *asynq.Task) error
	ProcessSaleCleanupTask(ctx context.Context, task *asynq.Task) error
}

// RedisTaskProcessor implementa TaskProcessor
type RedisTaskProcessor struct {
	server *asynq.Server
	mux    *asynq.ServeMux
}

// NewRedisTaskProcessor crea un nuevo procesador de tareas
func NewRedisTaskProcessor(redisOpt asynq.RedisClientOpt) TaskProcessor {
	server := asynq.NewServer(
		redisOpt,
		asynq.Config{
			// Configuración de concurrencia
			Concurrency: 10, // 10 workers en paralelo
			
			// Configuración de colas con prioridades
			Queues: map[string]int{
				"critical": 6,  // 60% de workers para tareas críticas
				"default":  3,  // 30% para tareas normales
				"webhooks": 1,  // 10% para webhooks
			},
			
			// Configuración de reintentos (se aplica globalmente)
			// Los reintentos específicos se configuran por tarea en el distributor
			
			// Error handler
			ErrorHandler: asynq.ErrorHandlerFunc(func(ctx context.Context, task *asynq.Task, err error) {
				retried, _ := asynq.GetRetryCount(ctx)
				maxRetry, _ := asynq.GetMaxRetry(ctx)
				
				log.Printf("❌ Task failed: type=%s, retry=%d/%d, error=%v",
					task.Type(), retried, maxRetry, err)
				
				// Si es el último intento, guardar en BD para revisión manual
				if retried >= maxRetry {
					log.Printf("🚨 Task permanently failed after %d retries: %s", maxRetry, task.Type())
					// TODO: Guardar en tabla de failed_jobs para revisión manual
				}
			}),
			
			// Health check
			HealthCheckFunc: func(err error) {
				if err != nil {
					log.Printf("⚠️ Health check failed: %v", err)
				}
			},
			
			// Graceful shutdown
			ShutdownTimeout: 30 * time.Second,
		},
	)

	mux := asynq.NewServeMux()
	
	processor := &RedisTaskProcessor{
		server: server,
		mux:    mux,
	}
	
	// Registrar handlers
	mux.HandleFunc(TypeWompiCreatePaymentLink, processor.ProcessWompiCreatePaymentLink)
	mux.HandleFunc(TypeWompiVerifyPayment, processor.ProcessWompiVerifyPayment)
	mux.HandleFunc(TypeWompiProcessWebhook, processor.ProcessWompiWebhook)
	mux.HandleFunc(TypeReduceStock, processor.ProcessReduceStock)
	mux.HandleFunc(TypeSaleCleanup, processor.ProcessSaleCleanupTask)
	
	return processor
}

// Start inicia el procesador de tareas
func (processor *RedisTaskProcessor) Start() error {
	log.Println("🚀 Starting task processor...")
	return processor.server.Run(processor.mux)
}

// Stop detiene el procesador de tareas
func (processor *RedisTaskProcessor) Stop() {
	log.Println("🛑 Stopping task processor...")
	processor.server.Stop()
	processor.server.Shutdown()
}

// ─── Wompi API Helpers ────────────────────────────────────────────────────────

const (
	WompiAPIURL     = "https://production.wompi.co/v1"
	WompiSandboxURL = "https://sandbox.wompi.co/v1"
)

func getWompiAPIURL() string {
	publicKey := os.Getenv("WOMPI_PUBLIC_KEY")
	if len(publicKey) > 8 && publicKey[:8] == "pub_test" {
		return WompiSandboxURL
	}
	return WompiAPIURL
}

// ─── Task Handlers ────────────────────────────────────────────────────────────

// ProcessWompiCreatePaymentLink procesa la creación de un payment link
func (processor *RedisTaskProcessor) ProcessWompiCreatePaymentLink(
	ctx context.Context,
	task *asynq.Task,
) error {
	var payload WompiCreatePaymentLinkPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	log.Printf("📦 Processing payment link creation: sale_id=%d, amount=%d",
		payload.SaleID, payload.AmountInCents)

	// 1. Verificar que la venta existe y está en estado PENDING
	var saleStatus string
	err := db.Pool.QueryRow(
		ctx,
		`SELECT status FROM sales WHERE id = $1`,
		payload.SaleID,
	).Scan(&saleStatus)
	
	if err != nil {
		return fmt.Errorf("failed to get sale status: %w", err)
	}
	
	if saleStatus != "PENDING" {
		log.Printf("⚠️ Sale %d is not PENDING (status=%s), skipping", payload.SaleID, saleStatus)
		return nil // No es un error, simplemente ya fue procesada
	}

	// 2. Verificar stock disponible
	for _, item := range payload.Items {
		var currentStock int
		err := db.Pool.QueryRow(
			ctx,
			`SELECT stock FROM products WHERE id = $1`,
			item.ProductID,
		).Scan(&currentStock)
		
		if err != nil {
			return fmt.Errorf("failed to check stock for product %d: %w", item.ProductID, err)
		}
		
		if currentStock < item.Quantity {
			// Stock insuficiente - cancelar venta
			_, err = db.Pool.Exec(
				ctx,
				`UPDATE sales SET status = 'CANCELLED', 
				 payment_method = 'Stock insuficiente' WHERE id = $1`,
				payload.SaleID,
			)
			
			return fmt.Errorf("insufficient stock for product %d: available=%d, required=%d",
				item.ProductID, currentStock, item.Quantity)
		}
	}

	// 3. Crear payment link en Wompi
	privateKey := os.Getenv("WOMPI_PRIVATE_KEY")
	apiURL := getWompiAPIURL()
	
	expiresAt := time.Now().Add(24 * time.Hour).Format(time.RFC3339)
	
	paymentLinkPayload := map[string]interface{}{
		"name":             fmt.Sprintf("Orden %s", payload.Reference),
		"description":      fmt.Sprintf("Compra de %d productos", len(payload.Items)),
		"single_use":       true,
		"collect_shipping": false,
		"amount_in_cents":  payload.AmountInCents,
		"currency":         payload.Currency,
		"redirect_url":     payload.RedirectURL,
		"expires_at":       expiresAt,
	}

	payloadBytes, err := json.Marshal(paymentLinkPayload)
	if err != nil {
		return fmt.Errorf("failed to marshal payment link payload: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		"POST",
		fmt.Sprintf("%s/payment_links", apiURL),
		bytes.NewBuffer(payloadBytes),
	)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+privateKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", payload.IdempotencyKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		// Error de red - será reintentado automáticamente
		return fmt.Errorf("failed to call Wompi API: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Wompi API error: status=%d, body=%s", resp.StatusCode, string(body))
	}

	// 4. Parsear respuesta
	var wompiResp struct {
		Data struct {
			ID  string `json:"id"`
			URL string `json:"url"`
		} `json:"data"`
	}
	
	if err := json.Unmarshal(body, &wompiResp); err != nil {
		return fmt.Errorf("failed to unmarshal Wompi response: %w", err)
	}

	// 5. Actualizar venta en BD
	_, err = db.Pool.Exec(
		ctx,
		`UPDATE sales 
		 SET wompi_payment_link_id = $1, 
		     status = 'PAYMENT_LINK_CREATED',
		     updated_at = NOW()
		 WHERE id = $2`,
		wompiResp.Data.ID,
		payload.SaleID,
	)
	
	if err != nil {
		return fmt.Errorf("failed to update sale: %w", err)
	}

	log.Printf("✅ Payment link created successfully: sale_id=%d, link_id=%s",
		payload.SaleID, wompiResp.Data.ID)

	return nil
}

// ProcessWompiVerifyPayment procesa la verificación de un pago
func (processor *RedisTaskProcessor) ProcessWompiVerifyPayment(
	ctx context.Context,
	task *asynq.Task,
) error {
	var payload WompiVerifyPaymentPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	retryCount, _ := asynq.GetRetryCount(ctx)
	log.Printf("🔍 Verifying payment: transaction_id=%s, attempt=%d",
		payload.TransactionID, retryCount+1)

	// 1. Verificar estado actual en BD
	var currentStatus string
	err := db.Pool.QueryRow(
		ctx,
		`SELECT status FROM sales WHERE id = $1`,
		payload.SaleID,
	).Scan(&currentStatus)
	
	if err != nil {
		return fmt.Errorf("failed to get sale status: %w", err)
	}
	
	// Si ya fue aprobada o procesada, no hacer nada
	if currentStatus == "APPROVED" || currentStatus == "DECLINED" {
		log.Printf("ℹ️ Sale %d already processed (status=%s)", payload.SaleID, currentStatus)
		return nil
	}

	// 2. Consultar estado en Wompi
	privateKey := os.Getenv("WOMPI_PRIVATE_KEY")
	apiURL := getWompiAPIURL()
	
	req, err := http.NewRequestWithContext(
		ctx,
		"GET",
		fmt.Sprintf("%s/transactions/%s", apiURL, payload.TransactionID),
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+privateKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		// Error de red - será reintentado con exponential backoff
		return fmt.Errorf("failed to call Wompi API: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Wompi API error: status=%d, body=%s", resp.StatusCode, string(body))
	}

	// 3. Parsear respuesta
	var wompiResp struct {
		Data struct {
			ID                string `json:"id"`
			Status            string `json:"status"`
			StatusMessage     string `json:"status_message"`
			AmountInCents     int64  `json:"amount_in_cents"`
			PaymentMethodType string `json:"payment_method_type"`
		} `json:"data"`
	}
	
	if err := json.Unmarshal(body, &wompiResp); err != nil {
		return fmt.Errorf("failed to unmarshal Wompi response: %w", err)
	}

	// 4. Actualizar estado en BD
	dbStatus := "PENDING"
	paymentMethod := "Wompi - Pendiente"
	
	switch wompiResp.Data.Status {
	case "APPROVED":
		dbStatus = "APPROVED"
		paymentMethod = fmt.Sprintf("Wompi - %s", wompiResp.Data.PaymentMethodType)
	case "DECLINED":
		dbStatus = "DECLINED"
		paymentMethod = "Wompi - Rechazado"
	case "VOIDED":
		dbStatus = "VOIDED"
		paymentMethod = "Wompi - Cancelado"
	case "ERROR":
		dbStatus = "ERROR"
		paymentMethod = "Wompi - Error"
	}

	// Actualizar solo si el status es PENDING (idempotencia)
	result, err := db.Pool.Exec(
		ctx,
		`UPDATE sales 
		 SET status = $1, 
		     payment_method = $2, 
		     wompi_transaction_id = $3,
		     updated_at = NOW()
		 WHERE id = $4 AND status = 'PENDING'`,
		dbStatus,
		paymentMethod,
		payload.TransactionID,
		payload.SaleID,
	)
	
	if err != nil {
		return fmt.Errorf("failed to update sale: %w", err)
	}

	rowsAffected := result.RowsAffected()
	
	// 5. Si fue aprobado y se actualizó, reducir stock
	if dbStatus == "APPROVED" && rowsAffected > 0 {
		log.Printf("✅ Payment approved: sale_id=%d, reducing stock...", payload.SaleID)
		
		// Obtener items de la venta
		rows, err := db.Pool.Query(
			ctx,
			`SELECT product_id, quantity FROM sale_items WHERE sale_id = $1`,
			payload.SaleID,
		)
		
		if err != nil {
			return fmt.Errorf("failed to get sale items: %w", err)
		}
		defer rows.Close()
		
		// Reducir stock de cada producto
		for rows.Next() {
			var productID, quantity int
			if err := rows.Scan(&productID, &quantity); err != nil {
				log.Printf("⚠️ Error scanning sale item: %v", err)
				continue
			}
			
			_, err := db.Pool.Exec(
				ctx,
				`UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1`,
				quantity, productID,
			)
			
			if err != nil {
				log.Printf("⚠️ Error reducing stock for product %d: %v", productID, err)
			} else {
				log.Printf("✅ Stock reduced: product_id=%d, quantity=%d", productID, quantity)
			}
		}
	} else if rowsAffected == 0 {
		log.Printf("ℹ️ Sale %d was already processed, stock not reduced again", payload.SaleID)
	}

	log.Printf("✅ Payment verification completed: sale_id=%d, status=%s",
		payload.SaleID, dbStatus)

	return nil
}

// ProcessWompiWebhook procesa un webhook de Wompi
func (processor *RedisTaskProcessor) ProcessWompiWebhook(
	ctx context.Context,
	task *asynq.Task,
) error {
	var payload WompiWebhookPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	log.Printf("📨 Processing webhook: event=%s, transaction_id=%s",
		payload.Event, payload.TransactionID)

	// TODO: Implementar lógica de webhook según el evento
	// Por ahora, solo loguear
	
	return nil
}

// ProcessReduceStock procesa la reducción de stock
func (processor *RedisTaskProcessor) ProcessReduceStock(
	ctx context.Context,
	task *asynq.Task,
) error {
	var payload ReduceStockPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	log.Printf("📦 Reducing stock: sale_id=%d, items=%d", payload.SaleID, len(payload.Items))

	for _, item := range payload.Items {
		result, err := db.Pool.Exec(
			ctx,
			`UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1`,
			item.Quantity, item.ProductID,
		)
		
		if err != nil {
			return fmt.Errorf("failed to reduce stock for product %d: %w", item.ProductID, err)
		}
		
		rowsAffected := result.RowsAffected()
		if rowsAffected == 0 {
			return fmt.Errorf("insufficient stock for product %d", item.ProductID)
		}
		
		log.Printf("✅ Stock reduced: product_id=%d, quantity=%d", item.ProductID, item.Quantity)
	}

	return nil
}

// ProcessSaleCleanupTask cancela ventas de Wompi que siguen en estado PENDING después de 30 minutos.
// ⚠️ VALIDACIÓN ESTRICTA:
//   - Solo afecta pedidos de Wompi (wompi_reference IS NOT NULL).
//   - Los pedidos manuales (comprobante) son IGNORADOS por completo.
//   - Si Wompi ya envió el webhook de pago aprobado, esta tarea no hará nada.
func (processor *RedisTaskProcessor) ProcessSaleCleanupTask(
	ctx context.Context,
	task *asynq.Task,
) error {
	var payload SaleCleanupPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal sale cleanup payload: %w", err)
	}

	log.Printf("🧹 Processing sale cleanup: sale_id=%s", payload.SaleID)

	// 1. Consultar estado y wompi_reference ANTES de hacer cualquier cambio
	var currentStatus string
	var wompiReference *string // nullable
	err := db.Pool.QueryRow(
		ctx,
		`SELECT status, wompi_reference FROM sales WHERE id = $1`,
		payload.SaleID,
	).Scan(&currentStatus, &wompiReference)

	if err != nil {
		log.Printf("⚠️ Sale %s not found for cleanup, skipping: %v", payload.SaleID, err)
		return nil // No reintentar si la venta no existe
	}

	// 2. FILTRO CLAVE: Si NO es una venta de Wompi, ignorar completamente.
	//    Los pedidos manuales (comprobante) no tienen wompi_reference.
	if wompiReference == nil || *wompiReference == "" {
		log.Printf("ℹ️ Sale %s is a manual payment (no wompi_reference), cleanup skipped",
			payload.SaleID)
		return nil // Éxito — no es de Wompi, no tocar
	}

	// 3. VALIDACIÓN DE ESTADO: Solo cancelar si sigue pendiente.
	//    Si el webhook de Wompi ya la marcó como PAID/APPROVED/DECLINED, no tocar nada.
	if currentStatus != "PENDIENTE" && currentStatus != "PENDING" && currentStatus != "PAYMENT_LINK_CREATED" {
		log.Printf("✅ Sale %s already processed (status=%s), cleanup skipped",
			payload.SaleID, currentStatus)
		return nil // Éxito — ya fue procesada por webhook
	}

	// 4. UPDATE condicional con doble seguridad:
	//    - WHERE status IN (...) → idempotencia contra race conditions
	//    - WHERE wompi_reference IS NOT NULL → nunca tocar pagos manuales
	result, err := db.Pool.Exec(
		ctx,
		`UPDATE sales 
		 SET status = 'CANCELADO', 
		     payment_method = COALESCE(payment_method, '') || ' (Auto-cancelado por timeout)',
		     updated_at = NOW()
		 WHERE id = $1 
		   AND status IN ('PENDIENTE', 'PENDING', 'PAYMENT_LINK_CREATED')
		   AND wompi_reference IS NOT NULL`,
		payload.SaleID,
	)
	if err != nil {
		return fmt.Errorf("failed to cancel expired sale: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		log.Printf("ℹ️ Sale %s was not updated (already processed or manual payment), skipping", payload.SaleID)
		return nil
	}

	log.Printf("🧹 Sale %s auto-cancelled after 30min timeout (was: %s, ref: %s)",
		payload.SaleID, currentStatus, *wompiReference)

	return nil
}
