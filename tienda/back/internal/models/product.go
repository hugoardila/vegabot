package models

import (
	"github.com/google/uuid"
	"time"
)

type Product struct {
	ID           uuid.UUID  `json:"id"`
	CategoryID   *uuid.UUID `json:"category_id,omitempty"`
	CategoryName string     `json:"category_name,omitempty"`
	Name         string     `json:"name"`
	Description  *string    `json:"description,omitempty"`
	Price        float64    `json:"price"`
	Stock        int        `json:"stock"`
	IsDigital    bool       `json:"is_digital"`
	SKU          *string    `json:"sku,omitempty"`
	Status       bool       `json:"status"`
	Images       []string   `json:"images,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}
