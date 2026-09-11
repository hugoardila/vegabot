package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"punto_de_venta_api/internal/config"
	"punto_de_venta_api/internal/db"
	"punto_de_venta_api/internal/queue"
	"syscall"

	"github.com/hibiken/asynq"
)

func main() {
	// Cargar configuración
	cfg := config.Load()

	// Conectar a la base de datos
	db.Connect(cfg)

	log.Println("✅ Conectado a PostgreSQL")

	// Configurar Redis
	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "localhost"
	}

	redisPort := os.Getenv("REDIS_PORT")
	if redisPort == "" {
		redisPort = "6379"
	}

	redisPassword := os.Getenv("REDIS_PASSWORD")
	if redisPassword == "" {
		redisPassword = "redis123"
	}

	redisAddr := fmt.Sprintf("%s:%s", redisHost, redisPort)

	redisOpt := asynq.RedisClientOpt{
		Addr:     redisAddr,
		Password: redisPassword,
		DB:       0,
	}

	log.Printf("🔗 Conectando a Redis: %s", redisAddr)

	// Crear procesador de tareas
	processor := queue.NewRedisTaskProcessor(redisOpt)

	// Manejar señales de sistema para graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// Iniciar procesador en una goroutine
	go func() {
		log.Println("🚀 Worker iniciado - Procesando tareas...")
		if err := processor.Start(); err != nil {
			log.Fatalf("❌ Error al iniciar worker: %v", err)
		}
	}()

	// Esperar señal de terminación
	<-sigChan
	log.Println("\n🛑 Señal de terminación recibida, cerrando worker...")

	// Detener procesador
	processor.Stop()

	log.Println("👋 Worker detenido correctamente")
}
