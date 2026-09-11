package queue

import (
	"fmt"
	"os"
	"sync"

	"github.com/hibiken/asynq"
)

var (
	distributorInstance TaskDistributor
	distributorOnce     sync.Once
)

// GetDistributor retorna una instancia singleton del distribuidor de tareas
func GetDistributor() TaskDistributor {
	distributorOnce.Do(func() {
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

		distributorInstance = NewRedisTaskDistributor(redisOpt)
	})

	return distributorInstance
}
