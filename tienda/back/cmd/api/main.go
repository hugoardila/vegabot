package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"punto_de_venta_api/internal/config"
	"punto_de_venta_api/internal/db"
	"punto_de_venta_api/internal/filestore"
	"punto_de_venta_api/internal/idempotency"
	"punto_de_venta_api/internal/router"
)

// ─────────────────────────────────────────────────────────────────────────────
// JOB 1: Limpieza de pedidos CANCELADOS con más de 3 días
// Ticker: cada hora
// ─────────────────────────────────────────────────────────────────────────────

// startCleanupJob lanza en background el worker que limpia pedidos CANCELADOS
// con más de 3 días de antigüedad, eliminando sus comprobantes del SSD.
func startCleanupJob() {
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()

		// Ejecutar inmediatamente al arrancar el servidor para no esperar 1 hora
		runCleanup()

		for range ticker.C {
			runCleanup()
		}
	}()
}

// runCleanup implementa el patrón de 3 pasos para eliminar pedidos cancelados
// sin dejar archivos fantasma en el volumen Docker del SSD.
func runCleanup() {
	cutoff := time.Now().Add(-3 * 24 * time.Hour) // hace 3 días

	// ─── PASO 1: SELECT ───────────────────────────────────────────────────────
	// Recopilar IDs y URLs de comprobantes ANTES de tocar la base de datos.
	// Es fundamental leer primero para saber qué borrar del disco luego.
	rows, err := db.Pool.Query(context.Background(),
		`SELECT id, receipts
		 FROM sales
		 WHERE status = 'CANCELADO'
		   AND updated_at < $1
		   AND receipts IS NOT NULL
		   AND array_length(receipts, 1) > 0`,
		cutoff)
	if err != nil {
		log.Printf("❌ [cleanup-cancelados] Error al consultar pedidos: %v\n", err)
		return
	}
	defer rows.Close()

	type saleToDel struct {
		id       uuid.UUID
		receipts []string
	}
	var toDelete []saleToDel

	for rows.Next() {
		var s saleToDel
		if err := rows.Scan(&s.id, &s.receipts); err == nil && len(s.receipts) > 0 {
			toDelete = append(toDelete, s)
		}
	}
	rows.Close() // cerrar antes de iniciar transacciones

	if len(toDelete) == 0 {
		return // nada que limpiar en esta ejecución
	}

	// Recopilar todas las URLs en un slice plano para el paso de disco
	var allFileURLs []string
	for _, s := range toDelete {
		allFileURLs = append(allFileURLs, s.receipts...)
	}

	log.Printf("🔍 [cleanup-cancelados] %d pedido(s) candidatos a eliminar (%d archivo(s) en disco)\n",
		len(toDelete), len(allFileURLs))

	// ─── PASO 2: DB DELETE en transacción ────────────────────────────────────
	// Eliminamos los registros de BD dentro de una transacción atómica.
	// sale_items se elimina por CASCADE al borrar la venta.
	// Sólo si el Commit tiene éxito procedemos a tocar el disco.
	tx, err := db.Pool.Begin(context.Background())
	if err != nil {
		log.Printf("❌ [cleanup-cancelados] Error al iniciar transacción: %v\n", err)
		return
	}
	defer tx.Rollback(context.Background()) // no-op si ya se hizo Commit

	deletedCount := 0
	for _, s := range toDelete {
		tag, err := tx.Exec(context.Background(),
			`DELETE FROM sales WHERE id = $1`, s.id)
		if err != nil {
			log.Printf("⚠️  [cleanup-cancelados] Error al eliminar venta %s: %v (se omite)\n", s.id, err)
			continue
		}
		if tag.RowsAffected() > 0 {
			deletedCount++
		}
	}

	if deletedCount == 0 {
		log.Printf("⚠️  [cleanup-cancelados] Ninguna venta fue eliminada de BD, se cancela la purga de disco\n")
		return
	}

	// Confirmar la transacción — a partir de aquí el disco es la fuente de verdad
	if err := tx.Commit(context.Background()); err != nil {
		log.Printf("❌ [cleanup-cancelados] Error al confirmar transacción: %v — disco intacto\n", err)
		return
	}
	log.Printf("✅ [cleanup-cancelados] %d venta(s) eliminada(s) de PostgreSQL\n", deletedCount)

	// ─── PASO 3: DISC PURGE ───────────────────────────────────────────────────
	// Los registros de BD ya fueron confirmados como borrados.
	// Ahora eliminamos los archivos físicos del SSD mediante filestore.RemoveFile,
	// que internamente ejecuta os.Remove → syscall unlink en el contenedor Docker.
	// El bind mount garantiza que el espacio se libere INMEDIATAMENTE en el SSD.
	purged := 0
	for _, fileURL := range allFileURLs {
		if fileURL == "" {
			continue
		}
		if err := filestore.RemoveFileIgnoreNotFound(fileURL); err != nil {
			log.Printf("⚠️  [cleanup-cancelados] No se pudo purgar del SSD: %s — %v\n", fileURL, err)
			continue
		}
		purged++
	}

	log.Printf("🗑️  [cleanup-cancelados] Purga completada: %d/%d archivo(s) eliminado(s) del SSD\n",
		purged, len(allFileURLs))
}

// ─────────────────────────────────────────────────────────────────────────────
// JOB 2: Limpieza de comprobantes (receipts) con más de 30 días
// Ticker: cada 24 horas
//
// Regla de negocio: La VENTA se conserva (es un registro contable).
// Solo se purgan los archivos de comprobante y se limpia la columna receipts.
// ─────────────────────────────────────────────────────────────────────────────

// startReceiptsCleanupJob lanza el worker que limpia comprobantes de más de 30 días.
// Reemplaza a startFacturasCleanupJob, que operaba solo en disco sin consultar BD.
func startReceiptsCleanupJob() {
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		// Ejecutar inmediatamente al arrancar para no esperar 24 horas
		runReceiptsCleanup()

		for range ticker.C {
			runReceiptsCleanup()
		}
	}()
}

// runReceiptsCleanup implementa el patrón de 3 pasos para limpiar comprobantes viejos.
//
// La VENTA no se borra (es un registro contable permanente).
// Se hace UPDATE receipts = '{}' para desasociar los archivos del registro,
// y luego se eliminan los archivos físicos del SSD.
func runReceiptsCleanup() {
	cutoff := time.Now().AddDate(0, 0, -30) // hace 30 días exactos

	// ─── PASO 1: SELECT ───────────────────────────────────────────────────────
	// Recopilar las URLs de los comprobantes candidatos a purga.
	// Filtro: ventas creadas hace más de 30 días Y que aún tengan comprobantes.
	// Se usa created_at porque los receipts se suben en el momento de crear el pedido;
	// updated_at cambia con cada cambio de estado y sería una referencia imprecisa.
	rows, err := db.Pool.Query(context.Background(),
		`SELECT id, receipts
		 FROM sales
		 WHERE created_at < $1
		   AND receipts IS NOT NULL
		   AND array_length(receipts, 1) > 0`,
		cutoff)
	if err != nil {
		log.Printf("❌ [cleanup-receipts] Error al consultar ventas con comprobantes: %v\n", err)
		return
	}
	defer rows.Close()

	type saleWithReceipts struct {
		id       uuid.UUID
		receipts []string
	}
	var candidates []saleWithReceipts

	for rows.Next() {
		var s saleWithReceipts
		if err := rows.Scan(&s.id, &s.receipts); err == nil && len(s.receipts) > 0 {
			candidates = append(candidates, s)
		}
	}
	rows.Close()

	if len(candidates) == 0 {
		return // nada que limpiar
	}

	// Aplanar todas las URLs en un slice para el paso de disco
	var allFileURLs []string
	for _, s := range candidates {
		allFileURLs = append(allFileURLs, s.receipts...)
	}

	log.Printf("🔍 [cleanup-receipts] %d venta(s) con %d comprobante(s) candidatos a purga\n",
		len(candidates), len(allFileURLs))

	// ─── PASO 2: DB UPDATE en transacción ────────────────────────────────────
	// Limpiamos la columna receipts (array vacío) SIN borrar la venta.
	// Esto desasocia el registro de BD de los archivos, preservando el historial.
	tx, err := db.Pool.Begin(context.Background())
	if err != nil {
		log.Printf("❌ [cleanup-receipts] Error al iniciar transacción: %v\n", err)
		return
	}
	defer tx.Rollback(context.Background())

	updatedCount := 0
	for _, s := range candidates {
		tag, err := tx.Exec(context.Background(),
			`UPDATE sales
			 SET receipts = '{}', updated_at = NOW()
			 WHERE id = $1`,
			s.id)
		if err != nil {
			log.Printf("⚠️  [cleanup-receipts] Error al limpiar receipts de venta %s: %v (se omite)\n", s.id, err)
			continue
		}
		if tag.RowsAffected() > 0 {
			updatedCount++
		}
	}

	if updatedCount == 0 {
		log.Printf("⚠️  [cleanup-receipts] Ninguna venta fue actualizada, se cancela la purga de disco\n")
		return
	}

	// Confirmar transacción — solo a partir de aquí procedemos con el disco
	if err := tx.Commit(context.Background()); err != nil {
		log.Printf("❌ [cleanup-receipts] Error al confirmar transacción: %v — disco intacto\n", err)
		return
	}
	log.Printf("✅ [cleanup-receipts] %d venta(s) con receipts limpiados en PostgreSQL\n", updatedCount)

	// ─── PASO 3: DISC PURGE ───────────────────────────────────────────────────
	// La BD ya confirmó que receipts = '{}'. Ahora podemos destruir los bytes
	// del SSD de forma segura. filestore.RemoveFileIgnoreNotFound llama internamente
	// a os.Remove → syscall unlink → el kernel libera el inodo y los bloques del SSD
	// a través del bind mount del contenedor Docker, en tiempo real.
	purged := 0
	for _, fileURL := range allFileURLs {
		if fileURL == "" {
			continue
		}
		if err := filestore.RemoveFileIgnoreNotFound(fileURL); err != nil {
			log.Printf("⚠️  [cleanup-receipts] No se pudo purgar del SSD: %s — %v\n", fileURL, err)
			continue
		}
		purged++
	}

	log.Printf("🗑️  [cleanup-receipts] Purga completada: %d/%d comprobante(s) eliminado(s) del SSD\n",
		purged, len(allFileURLs))
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────

func main() {
	cfg := config.Load()
	db.Connect(cfg)
	defer db.Pool.Close()

	// Inicializar Redis para idempotencia
	if err := idempotency.InitRedis(); err != nil {
		log.Printf("⚠️ WARNING: Redis no disponible para idempotencia: %v\n", err)
		log.Printf("⚠️ El sistema funcionará sin protección de idempotencia\n")
	} else {
		log.Println("✅ Redis inicializado para idempotencia")
	}

	// Sembrar (Seed) usuarios iniciales si no existen
	db.SeedDefaultUsers(cfg)

	// Iniciar limpieza automática de pedidos CANCELADOS (+3 días)
	startCleanupJob()

	// Iniciar limpieza automática de comprobantes de pago (+30 días)
	// Reemplaza a startFacturasCleanupJob: ahora opera con BD + disco en 3 pasos
	startReceiptsCleanupJob()

	r := router.New()

	addr := fmt.Sprintf(":%s", cfg.Port)

	// Servidor listo
	fmt.Printf("🚀 Servidor iniciado en puerto %s\n", cfg.Port)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("❌ Error crítico al iniciar servidor: %v\n", err)
	}
}
