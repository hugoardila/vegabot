package queue

import (
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
)

// ─── Task Types ───────────────────────────────────────────────────────────────
const (
	TypeWompiCreatePaymentLink = "wompi:create_payment_link"
	TypeWompiVerifyPayment     = "wompi:verify_payment"
	TypeWompiProcessWebhook    = "wompi:process_webhook"
	TypeReduceStock            = "inventory:reduce_stock"
	TypeSaleCleanup            = "sale:cleanup_pending"
)

// ─── Task Payloads ────────────────────────────────────────────────────────────

// WompiCreatePaymentLinkPayload contiene los datos necesarios para crear un payment link
type WompiCreatePaymentLinkPayload struct {
	SaleID           uuid.UUID              `json:"sale_id"`
	UserID           uuid.UUID              `json:"user_id"`
	AmountInCents    int64                  `json:"amount_in_cents"`
	Currency         string                 `json:"currency"`
	CustomerEmail    string                 `json:"customer_email"`
	CustomerData     CustomerData           `json:"customer_data"`
	ShippingAddress  ShippingAddress        `json:"shipping_address"`
	RedirectURL      string                 `json:"redirect_url"`
	Reference        string                 `json:"reference"`
	IdempotencyKey   string                 `json:"idempotency_key"`
	Items            []SaleItem             `json:"items"`
}

// WompiVerifyPaymentPayload contiene los datos para verificar un pago
type WompiVerifyPaymentPayload struct {
	SaleID        uuid.UUID `json:"sale_id"`
	TransactionID string    `json:"transaction_id"`
	Reference     string    `json:"reference"`
	AttemptNumber int       `json:"attempt_number"` // Para tracking de reintentos
}

// WompiWebhookPayload contiene los datos del webhook de Wompi
type WompiWebhookPayload struct {
	Event         string                 `json:"event"`
	Data          map[string]interface{} `json:"data"`
	SentAt        string                 `json:"sent_at"`
	TransactionID string                 `json:"transaction_id"`
}

// ReduceStockPayload contiene los datos para reducir stock
type ReduceStockPayload struct {
	SaleID     uuid.UUID  `json:"sale_id"`
	Items      []SaleItem `json:"items"`
	RollbackOn string     `json:"rollback_on"` // "payment_failed" para revertir si falla
}

// SaleCleanupPayload contiene los datos para la tarea de limpieza de ventas abandonadas
type SaleCleanupPayload struct {
	SaleID uuid.UUID `json:"sale_id"`
}

// CustomerData representa los datos del cliente
type CustomerData struct {
	FullName    string `json:"full_name"`
	PhoneNumber string `json:"phone_number"`
	LegalID     string `json:"legal_id"`
	LegalIDType string `json:"legal_id_type"`
}

// ShippingAddress representa la dirección de envío
type ShippingAddress struct {
	AddressLine1 string `json:"address_line_1"`
	Country      string `json:"country"`
	PhoneNumber  string `json:"phone_number"`
}

// SaleItem representa un item de la venta
type SaleItem struct {
	ProductID   uuid.UUID `json:"product_id"`
	ProductName string    `json:"product_name"`
	Quantity    int       `json:"quantity"`
	UnitPrice   float64   `json:"unit_price"`
}

// ─── Task Constructors ────────────────────────────────────────────────────────

// NewWompiCreatePaymentLinkTask crea una nueva tarea para crear un payment link
func NewWompiCreatePaymentLinkTask(payload WompiCreatePaymentLinkPayload) (*asynq.Task, error) {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}
	
	return asynq.NewTask(TypeWompiCreatePaymentLink, payloadBytes), nil
}

// NewWompiVerifyPaymentTask crea una nueva tarea para verificar un pago
func NewWompiVerifyPaymentTask(payload WompiVerifyPaymentPayload) (*asynq.Task, error) {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}
	
	return asynq.NewTask(TypeWompiVerifyPayment, payloadBytes), nil
}

// NewWompiWebhookTask crea una nueva tarea para procesar un webhook
func NewWompiWebhookTask(payload WompiWebhookPayload) (*asynq.Task, error) {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}
	
	return asynq.NewTask(TypeWompiProcessWebhook, payloadBytes), nil
}

// NewReduceStockTask crea una nueva tarea para reducir stock
func NewReduceStockTask(payload ReduceStockPayload) (*asynq.Task, error) {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}
	
	return asynq.NewTask(TypeReduceStock, payloadBytes), nil
}

// NewSaleCleanupTask crea una nueva tarea para limpiar ventas abandonadas
func NewSaleCleanupTask(payload SaleCleanupPayload) (*asynq.Task, error) {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}
	
	return asynq.NewTask(TypeSaleCleanup, payloadBytes), nil
}
