package idempotency

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	redisClient *redis.Client
)

// InitRedis inicializa el cliente de Redis para idempotencia
func InitRedis() error {
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

	redisClient = redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: redisPassword,
		DB:       1, // Usar DB 1 para idempotencia (DB 0 para Asynq)
	})

	// Verificar conexión
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := redisClient.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("error al conectar con Redis: %w", err)
	}

	fmt.Printf("✅ Redis conectado para idempotencia: %s (DB 1)\n", redisAddr)
	return nil
}

// GetRedisClient retorna el cliente de Redis
func GetRedisClient() *redis.Client {
	return redisClient
}

// IdempotencyResponse representa la respuesta guardada en Redis
type IdempotencyResponse struct {
	StatusCode int                    `json:"status_code"`
	Body       map[string]interface{} `json:"body"`
	Timestamp  time.Time              `json:"timestamp"`
}

// CheckIdempotency verifica si una petición ya fue procesada
// Retorna (response, found, error)
func CheckIdempotency(ctx context.Context, key string) (*IdempotencyResponse, bool, error) {
	if redisClient == nil {
		return nil, false, fmt.Errorf("Redis no está inicializado")
	}

	val, err := redisClient.Get(ctx, key).Result()
	if err == redis.Nil {
		// La llave no existe, es una petición nueva
		return nil, false, nil
	}
	if err != nil {
		// Error al consultar Redis
		return nil, false, fmt.Errorf("error al consultar Redis: %w", err)
	}

	// La llave existe, deserializar la respuesta
	var response IdempotencyResponse
	if err := json.Unmarshal([]byte(val), &response); err != nil {
		return nil, false, fmt.Errorf("error al deserializar respuesta: %w", err)
	}

	return &response, true, nil
}

// SaveIdempotency guarda la respuesta de una petición en Redis
func SaveIdempotency(ctx context.Context, key string, statusCode int, body map[string]interface{}, ttl time.Duration) error {
	if redisClient == nil {
		return fmt.Errorf("Redis no está inicializado")
	}

	response := IdempotencyResponse{
		StatusCode: statusCode,
		Body:       body,
		Timestamp:  time.Now(),
	}

	data, err := json.Marshal(response)
	if err != nil {
		return fmt.Errorf("error al serializar respuesta: %w", err)
	}

	if err := redisClient.Set(ctx, key, data, ttl).Err(); err != nil {
		return fmt.Errorf("error al guardar en Redis: %w", err)
	}

	return nil
}

// GenerateWebhookKey genera una llave de idempotencia para webhooks
func GenerateWebhookKey(transactionID string) string {
	return fmt.Sprintf("webhook:wompi:%s", transactionID)
}

// GenerateVerifyKey genera una llave de idempotencia para verificaciones
func GenerateVerifyKey(transactionID string) string {
	return fmt.Sprintf("verify:wompi:%s", transactionID)
}
