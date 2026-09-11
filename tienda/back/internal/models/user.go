package models

import (
	"github.com/google/uuid"
	"time"
)

type UserRole string

const (
	RoleSuperAdmin UserRole = "super_admin"
	RoleAdmin      UserRole = "admin"
	RoleCliente    UserRole = "cliente"
)

type User struct {
	ID           uuid.UUID `json:"id"`
	FullName     string    `json:"full_name"`
	Email        *string   `json:"email"`
	GoogleID     *string   `json:"google_id,omitempty"`
	PasswordHash *string   `json:"-"`
	Phone        *string   `json:"phone,omitempty"`
	IDNumber     *string   `json:"id_number,omitempty"`
	Role         UserRole  `json:"role"`
	Status       bool      `json:"status"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
