package services

import (
	"context"
	"fmt"
	"log"
	"punto_de_venta_api/internal/db"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// SaleStatus representa los estados posibles de una venta
type SaleStatus string

const (
	StatusPending   SaleStatus = "PENDING"
	StatusPaid      SaleStatus = "PAID"
	StatusApproved  SaleStatus = "APPROVED" // Alias de PAID para compatibilidad
	StatusDeclined  SaleStatus = "DECLINED"
	StatusVoided    SaleStatus = "VOIDED"
	StatusError     SaleStatus = "ERROR"
	StatusCancelled SaleStatus = "CANCELLED"
)

// PaymentResult representa el resultado del procesamiento de un pago
type PaymentResult struct {
	SaleID         uuid.UUID
	PreviousStatus SaleStatus
	NewStatus      SaleStatus
	StockReduced   bool
	AlreadyPaid    bool
	TransactionID  string
	PaymentMethod  string
}

// ProcessPaymentApproval procesa la aprobación de un pago de forma idempotente
// Esta función implementa una máquina de estados y garantiza que el stock
// solo se descuente una vez, incluso si se llama múltiples veces
func ProcessPaymentApproval(ctx context.Context, transactionID, paymentLinkID, reference string, amountInCents int64, paymentMethodType string) (*PaymentResult, error) {
	log.Printf("🔄 ProcessPaymentApproval iniciado")
	log.Printf("   - TransactionID: %s", transactionID)
	log.Printf("   - PaymentLinkID: %s", paymentLinkID)
	log.Printf("   - Reference: %s", reference)
	log.Printf("   - Amount: %d centavos", amountInCents)

	result := &PaymentResult{
		TransactionID: transactionID,
		StockReduced:  false,
		AlreadyPaid:   false,
	}

	// Iniciar una transacción de base de datos
	log.Printf("🔄 Iniciando transacción de base de datos...")
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		log.Printf("❌ Error al iniciar transacción: %v", err)
		return nil, fmt.Errorf("error al iniciar transacción: %w", err)
	}
	defer tx.Rollback(ctx) // Rollback si no se hace commit

	log.Printf("✅ Transacción de base de datos iniciada")

	// PASO 1: Buscar la venta y bloquear la fila (SELECT FOR UPDATE)
	// Esto previene condiciones de carrera entre múltiples peticiones concurrentes
	var saleID uuid.UUID
	var currentStatus string
	var currentPaymentMethod string

	log.Printf("🔍 Buscando venta...")
	log.Printf("   - Buscando por payment_link_id: %s", paymentLinkID)

	// Intentar buscar por payment_link_id primero (es lo que se guarda al crear el payment link)
	err = tx.QueryRow(ctx,
		`SELECT id, status, payment_method 
		 FROM sales 
		 WHERE wompi_payment_link_id = $1
		 FOR UPDATE`,
		paymentLinkID,
	).Scan(&saleID, &currentStatus, &currentPaymentMethod)

	// Si no se encuentra por payment_link_id, buscar por transaction_id
	if err == pgx.ErrNoRows && transactionID != "" {
		log.Printf("   - No encontrado por payment_link_id, buscando por transaction_id: %s", transactionID)
		err = tx.QueryRow(ctx,
			`SELECT id, status, payment_method 
			 FROM sales 
			 WHERE wompi_transaction_id = $1
			 FOR UPDATE`,
			transactionID,
		).Scan(&saleID, &currentStatus, &currentPaymentMethod)
	}

	// Si no se encuentra por transaction_id, buscar por referencia
	if err == pgx.ErrNoRows && reference != "" {
		log.Printf("   - No encontrado por transaction_id, buscando por reference: %s", reference)
		err = tx.QueryRow(ctx,
			`SELECT id, status, payment_method 
			 FROM sales 
			 WHERE wompi_reference = $1
			 FOR UPDATE`,
			reference,
		).Scan(&saleID, &currentStatus, &currentPaymentMethod)
	}

	// Si no se encuentra por referencia, buscar por monto (últimas 24 horas)
	if err == pgx.ErrNoRows && amountInCents > 0 {
		log.Printf("   - No encontrado por reference, buscando por monto: %d", amountInCents)
		err = tx.QueryRow(ctx,
			`SELECT id, status, payment_method 
			 FROM sales 
			 WHERE total_amount = $1 
			   AND status = 'PENDING'
			   AND created_at > NOW() - INTERVAL '24 hours'
			 ORDER BY created_at DESC
			 LIMIT 1
			 FOR UPDATE`,
			float64(amountInCents)/100.0,
		).Scan(&saleID, &currentStatus, &currentPaymentMethod)
	}

	if err != nil {
		if err == pgx.ErrNoRows {
			log.Printf("❌ Venta no encontrada - TransactionID: %s, PaymentLinkID: %s, Reference: %s, Amount: %d",
				transactionID, paymentLinkID, reference, amountInCents)
			return nil, fmt.Errorf("venta no encontrada")
		}
		log.Printf("❌ Error al buscar venta: %v", err)
		return nil, fmt.Errorf("error al buscar venta: %w", err)
	}

	result.SaleID = saleID
	result.PreviousStatus = SaleStatus(currentStatus)

	log.Printf("🔍 Venta encontrada: ID=%s, Status=%s", saleID, currentStatus)

	// PASO 2: Validar la máquina de estados
	// Si la venta ya está en estado PAID, APPROVED o cualquier estado final,
	// no hacer nada y retornar que ya fue procesada
	if currentStatus == string(StatusPaid) || currentStatus == string(StatusApproved) {
		log.Printf("⚠️ Venta %s ya está pagada (Status: %s). Ignorando petición duplicada.", saleID, currentStatus)
		result.AlreadyPaid = true
		result.NewStatus = SaleStatus(currentStatus)
		result.PaymentMethod = currentPaymentMethod
		// Hacer commit para liberar el lock
		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("error al hacer commit: %w", err)
		}
		return result, nil
	}

	// Si la venta está en un estado final no exitoso, no procesarla
	if currentStatus == string(StatusDeclined) || currentStatus == string(StatusVoided) || currentStatus == string(StatusError) {
		log.Printf("⚠️ Venta %s está en estado final %s. No se puede aprobar.", saleID, currentStatus)
		result.NewStatus = SaleStatus(currentStatus)
		result.PaymentMethod = currentPaymentMethod
		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("error al hacer commit: %w", err)
		}
		return result, nil
	}

	// PASO 3: La venta está en PENDING, proceder a aprobarla
	log.Printf("✅ Venta %s en estado PENDING. Procesando aprobación...", saleID)

	_, err = tx.Exec(ctx,
		`UPDATE sales 
		 SET status = $1, 
		     wompi_transaction_id = $2,
		     updated_at = NOW()
		 WHERE id = $3`,
		string(StatusPaid),
		transactionID,
		saleID,
	)

	if err != nil {
		return nil, fmt.Errorf("error al actualizar venta: %w", err)
	}

	result.NewStatus = StatusPaid
	result.PaymentMethod = currentPaymentMethod // keep the original carrier value

	log.Printf("✅ Venta %s actualizada a PAID", saleID)

	// PASO 4: Reducir el stock de los productos
	// Obtener los items de la venta
	log.Printf("🔄 Obteniendo items de la venta %s...", saleID)
	rows, err := tx.Query(ctx,
		`SELECT product_id, quantity 
		 FROM sale_items 
		 WHERE sale_id = $1`,
		saleID,
	)

	if err != nil {
		return nil, fmt.Errorf("error al obtener items de venta: %w", err)
	}

	// Leer todos los items primero y cerrar el cursor
	type saleItem struct {
		productID uuid.UUID
		quantity  int
	}
	var items []saleItem

	for rows.Next() {
		var item saleItem
		if err := rows.Scan(&item.productID, &item.quantity); err != nil {
			rows.Close()
			return nil, fmt.Errorf("error al leer item de venta: %w", err)
		}
		items = append(items, item)
	}

	// Cerrar el cursor ANTES de hacer las actualizaciones
	rows.Close()

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error al iterar items de venta: %w", err)
	}

	log.Printf("✅ Se encontraron %d items para procesar", len(items))

	// Ahora reducir el stock de cada producto
	for _, item := range items {
		log.Printf("🔄 Reduciendo stock del producto %s (cantidad: %d)...", item.productID, item.quantity)

		// Reducir el stock del producto
		// IMPORTANTE: Usar stock >= $1 para evitar stock negativo
		cmdTag, err := tx.Exec(ctx,
			`UPDATE products 
			 SET stock = stock - $1, updated_at = NOW()
			 WHERE id = $2 AND stock >= $1`,
			item.quantity,
			item.productID,
		)

		if err != nil {
			return nil, fmt.Errorf("error al reducir stock del producto %s: %w", item.productID, err)
		}

		rowsAffected := cmdTag.RowsAffected()
		if rowsAffected == 0 {
			// No se pudo reducir el stock (probablemente stock insuficiente)
			return nil, fmt.Errorf("stock insuficiente para producto %s (requiere %d unidades)", item.productID, item.quantity)
		}

		log.Printf("✅ Stock reducido para producto %s: -%d unidades", item.productID, item.quantity)
		result.StockReduced = true
	}

	// PASO 5: Hacer commit de la transacción
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("error al hacer commit: %w", err)
	}

	log.Printf("✅ Pago procesado exitosamente: Sale ID=%s, Stock reducido=%v", saleID, result.StockReduced)

	return result, nil
}

// ProcessPaymentDecline procesa el rechazo de un pago
func ProcessPaymentDecline(ctx context.Context, transactionID, paymentLinkID, reference string) error {
	// Buscar la venta
	var saleID uuid.UUID
	var currentStatus string

	err := db.Pool.QueryRow(ctx,
		`SELECT id, status FROM sales 
		 WHERE wompi_transaction_id = $1 OR wompi_payment_link_id = $2 OR wompi_reference = $3
		 LIMIT 1`,
		transactionID, paymentLinkID, reference,
	).Scan(&saleID, &currentStatus)

	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("venta no encontrada")
		}
		return fmt.Errorf("error al buscar venta: %w", err)
	}

	// Solo actualizar si está en PENDING
	if currentStatus != string(StatusPending) {
		log.Printf("⚠️ Venta %s no está en PENDING (Status: %s). No se actualiza.", saleID, currentStatus)
		return nil
	}

	// Actualizar a DECLINED
	_, err = db.Pool.Exec(ctx,
		`UPDATE sales 
		 SET status = $1, payment_method = $2, updated_at = NOW()
		 WHERE id = $3`,
		string(StatusDeclined),
		"Wompi - Rechazado",
		saleID,
	)

	if err != nil {
		return fmt.Errorf("error al actualizar venta: %w", err)
	}

	log.Printf("✅ Venta %s marcada como DECLINED", saleID)
	return nil
}

// ProcessPaymentVoid procesa la cancelación de un pago
func ProcessPaymentVoid(ctx context.Context, transactionID, paymentLinkID, reference string) error {
	// Buscar la venta
	var saleID uuid.UUID
	var currentStatus string

	err := db.Pool.QueryRow(ctx,
		`SELECT id, status FROM sales 
		 WHERE wompi_transaction_id = $1 OR wompi_payment_link_id = $2 OR wompi_reference = $3
		 LIMIT 1`,
		transactionID, paymentLinkID, reference,
	).Scan(&saleID, &currentStatus)

	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("venta no encontrada")
		}
		return fmt.Errorf("error al buscar venta: %w", err)
	}

	// Solo actualizar si está en PENDING
	if currentStatus != string(StatusPending) {
		log.Printf("⚠️ Venta %s no está en PENDING (Status: %s). No se actualiza.", saleID, currentStatus)
		return nil
	}

	// Actualizar a VOIDED
	_, err = db.Pool.Exec(ctx,
		`UPDATE sales 
		 SET status = $1, payment_method = $2, updated_at = NOW()
		 WHERE id = $3`,
		string(StatusVoided),
		"Wompi - Cancelado",
		saleID,
	)

	if err != nil {
		return fmt.Errorf("error al actualizar venta: %w", err)
	}

	log.Printf("✅ Venta %s marcada como VOIDED", saleID)
	return nil
}
