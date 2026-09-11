package queue

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
)

// TaskDistributor es responsable de distribuir tareas a la cola
type TaskDistributor interface {
	DistributeWompiCreatePaymentLink(ctx context.Context, payload WompiCreatePaymentLinkPayload, opts ...asynq.Option) error
	DistributeWompiVerifyPayment(ctx context.Context, payload WompiVerifyPaymentPayload, opts ...asynq.Option) error
	DistributeWompiWebhook(ctx context.Context, payload WompiWebhookPayload, opts ...asynq.Option) error
	DistributeReduceStock(ctx context.Context, payload ReduceStockPayload, opts ...asynq.Option) error
	DistributeSaleCleanupTask(ctx context.Context, saleID uuid.UUID, opts ...asynq.Option) error
}

// RedisTaskDistributor implementa TaskDistributor usando Redis
type RedisTaskDistributor struct {
	client *asynq.Client
}

// NewRedisTaskDistributor crea un nuevo distribuidor de tareas
func NewRedisTaskDistributor(redisOpt asynq.RedisClientOpt) TaskDistributor {
	client := asynq.NewClient(redisOpt)
	return &RedisTaskDistributor{
		client: client,
	}
}

// DistributeWompiCreatePaymentLink encola una tarea para crear un payment link
func (distributor *RedisTaskDistributor) DistributeWompiCreatePaymentLink(
	ctx context.Context,
	payload WompiCreatePaymentLinkPayload,
	opts ...asynq.Option,
) error {
	task, err := NewWompiCreatePaymentLinkTask(payload)
	if err != nil {
		return fmt.Errorf("failed to create task: %w", err)
	}

	// Opciones por defecto si no se especifican
	if len(opts) == 0 {
		opts = []asynq.Option{
			asynq.MaxRetry(3),                    // Reintentar hasta 3 veces
			asynq.Timeout(2 * time.Minute),       // Timeout de 2 minutos
			asynq.Queue("critical"),              // Cola de alta prioridad
			asynq.ProcessIn(5 * time.Second),     // Procesar después de 5 segundos
			asynq.Retention(24 * time.Hour),      // Retener por 24 horas
		}
	}

	info, err := distributor.client.EnqueueContext(ctx, task, opts...)
	if err != nil {
		return fmt.Errorf("failed to enqueue task: %w", err)
	}

	log.Printf("✅ Task enqueued: type=%s, queue=%s, max_retry=%d, sale_id=%d",
		task.Type(), info.Queue, info.MaxRetry, payload.SaleID)

	return nil
}

// DistributeWompiVerifyPayment encola una tarea para verificar un pago
func (distributor *RedisTaskDistributor) DistributeWompiVerifyPayment(
	ctx context.Context,
	payload WompiVerifyPaymentPayload,
	opts ...asynq.Option,
) error {
	task, err := NewWompiVerifyPaymentTask(payload)
	if err != nil {
		return fmt.Errorf("failed to create task: %w", err)
	}

	// Opciones por defecto con Exponential Backoff
	if len(opts) == 0 {
		opts = []asynq.Option{
			asynq.MaxRetry(5),                    // Más reintentos para verificación
			asynq.Timeout(30 * time.Second),      // Timeout más corto
			asynq.Queue("default"),               // Cola normal
			asynq.Retention(48 * time.Hour),      // Retener por 48 horas
		}
	}

	_, err = distributor.client.EnqueueContext(ctx, task, opts...)
	if err != nil {
		return fmt.Errorf("failed to enqueue task: %w", err)
	}

	log.Printf("✅ Task enqueued: type=%s, max_retry=5, transaction_id=%s",
		task.Type(), payload.TransactionID)

	return nil
}

// DistributeWompiWebhook encola una tarea para procesar un webhook
func (distributor *RedisTaskDistributor) DistributeWompiWebhook(
	ctx context.Context,
	payload WompiWebhookPayload,
	opts ...asynq.Option,
) error {
	task, err := NewWompiWebhookTask(payload)
	if err != nil {
		return fmt.Errorf("failed to create task: %w", err)
	}

	// Webhooks deben procesarse inmediatamente
	if len(opts) == 0 {
		opts = []asynq.Option{
			asynq.MaxRetry(2),                    // Pocos reintentos
			asynq.Timeout(30 * time.Second),
			asynq.Queue("webhooks"),              // Cola dedicada para webhooks
			asynq.ProcessIn(0),                   // Procesar inmediatamente
		}
	}

	_, err = distributor.client.EnqueueContext(ctx, task, opts...)
	if err != nil {
		return fmt.Errorf("failed to enqueue task: %w", err)
	}

	log.Printf("✅ Webhook task enqueued: event=%s, transaction_id=%s",
		payload.Event, payload.TransactionID)

	return nil
}

// DistributeReduceStock encola una tarea para reducir stock
func (distributor *RedisTaskDistributor) DistributeReduceStock(
	ctx context.Context,
	payload ReduceStockPayload,
	opts ...asynq.Option,
) error {
	task, err := NewReduceStockTask(payload)
	if err != nil {
		return fmt.Errorf("failed to create task: %w", err)
	}

	// Stock debe reducirse de forma confiable
	if len(opts) == 0 {
		opts = []asynq.Option{
			asynq.MaxRetry(3),
			asynq.Timeout(1 * time.Minute),
			asynq.Queue("critical"),              // Alta prioridad
			asynq.Unique(24 * time.Hour),         // Evitar duplicados por 24h
		}
	}

	_, err = distributor.client.EnqueueContext(ctx, task, opts...)
	if err != nil {
		return fmt.Errorf("failed to enqueue task: %w", err)
	}

	log.Printf("✅ Stock reduction task enqueued: sale_id=%d, items=%d",
		payload.SaleID, len(payload.Items))

	return nil
}

// DistributeSaleCleanupTask encola una tarea retrasada para cancelar ventas abandonadas
func (distributor *RedisTaskDistributor) DistributeSaleCleanupTask(
	ctx context.Context,
	saleID uuid.UUID,
	opts ...asynq.Option,
) error {
	payload := SaleCleanupPayload{SaleID: saleID}

	task, err := NewSaleCleanupTask(payload)
	if err != nil {
		return fmt.Errorf("failed to create sale cleanup task: %w", err)
	}

	// Opciones por defecto: ejecutar en 30 minutos
	if len(opts) == 0 {
		opts = []asynq.Option{
			asynq.MaxRetry(1),                    // Un solo reintento, es una tarea de limpieza
			asynq.Timeout(30 * time.Second),      // Timeout corto, es una query simple
			asynq.Queue("default"),               // Cola normal, no es crítico
			asynq.ProcessIn(30 * time.Minute),    // ⏰ Ejecutar en 30 minutos
			asynq.Retention(24 * time.Hour),      // Retener resultado por 24 horas
		}
	}

	info, err := distributor.client.EnqueueContext(ctx, task, opts...)
	if err != nil {
		return fmt.Errorf("failed to enqueue sale cleanup task: %w", err)
	}

	log.Printf("🧹 Sale cleanup task enqueued: sale_id=%s, queue=%s, process_in=30m",
		saleID, info.Queue)

	return nil
}

// Close cierra el cliente de Asynq
func (distributor *RedisTaskDistributor) Close() error {
	return distributor.client.Close()
}
