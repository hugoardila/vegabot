package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DBHost           string
	DBPort           string
	DBUser           string
	DBPassword       string
	DBName           string
	JWTSecret        string
	Port             string
	SuperAdminEmail  string
	SuperAdminPass   string
}

func Load() *Config {
	// Cargar .env silenciosamente (si existe)
	_ = godotenv.Load()

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("Error de configuración")
	}

	superAdminEmail := os.Getenv("SUPERADMIN_EMAIL")
	if superAdminEmail == "" {
		log.Fatal("Error de configuración: SUPERADMIN_EMAIL no está definido")
	}

	superAdminPass := os.Getenv("SUPERADMIN_PASSWORD")
	if superAdminPass == "" {
		log.Fatal("Error de configuración")
	}

	return &Config{
		DBHost:           getEnv("DB_HOST", "localhost"),
		DBPort:           getEnv("DB_PORT", "5432"),
		DBUser:           getEnv("DB_USER", "postgres"),
		DBPassword:       getEnv("DB_PASSWORD", ""),
		DBName:           getEnv("DB_NAME", "punto_de_venta"),
		JWTSecret:        jwtSecret,
		Port:             getEnv("PORT", "8080"),
		SuperAdminEmail:  superAdminEmail,
		SuperAdminPass:   superAdminPass,
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
