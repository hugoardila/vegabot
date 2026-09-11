package models

import (
	"time"

	"github.com/google/uuid"
)

type Supplier struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	Name        string     `json:"name" db:"name"`
	ContactName *string    `json:"contact_name,omitempty" db:"contact_name"`
	Address     *string    `json:"address,omitempty" db:"address"`
	City        *string    `json:"city,omitempty" db:"city"`
	Phone       *string    `json:"phone,omitempty" db:"phone"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

type CreateSupplierRequest struct {
	Name        string  `json:"name" binding:"required"`
	ContactName *string `json:"contact_name,omitempty"`
	Address     *string `json:"address,omitempty"`
	City        *string `json:"city,omitempty"`
	Phone       *string `json:"phone,omitempty"`
}

type UpdateSupplierRequest struct {
	Name        *string `json:"name,omitempty"`
	ContactName *string `json:"contact_name,omitempty"`
	Address     *string `json:"address,omitempty"`
	City        *string `json:"city,omitempty"`
	Phone       *string `json:"phone,omitempty"`
}
