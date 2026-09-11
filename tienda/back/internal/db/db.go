package db

import (
	"context"
	"fmt"
	"log"
	"punto_de_venta_api/internal/config"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

var Pool *pgxpool.Pool

func Connect(cfg *config.Config) {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName,
	)

	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		log.Fatal("Error de conexión")
	}

	if err := pool.Ping(context.Background()); err != nil {
		log.Fatal("Error de conexión")
	}

	Pool = pool
}

func SeedDefaultUsers(cfg *config.Config) {
	// Verificar si ya existe CUALQUIER super_admin en toda la base de datos
	var exists bool
	err := Pool.QueryRow(context.Background(), "SELECT EXISTS(SELECT 1 FROM users WHERE role='super_admin')").Scan(&exists)
	if err != nil {
		return
	}

	if !exists {
		hash, err := bcrypt.GenerateFromPassword([]byte(cfg.SuperAdminPass), bcrypt.DefaultCost)
		if err != nil {
			log.Fatal("Error de configuración")
		}

		_, err = Pool.Exec(context.Background(),
			`INSERT INTO users (full_name, email, password_hash, role)
			 VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
			"Super Administrador", cfg.SuperAdminEmail, string(hash), "super_admin",
		)
		if err != nil {
			// Error silencioso
			return
		}
	}
}
