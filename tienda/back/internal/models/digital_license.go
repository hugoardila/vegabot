package models

import (
	"github.com/google/uuid"
	"time"
)

type DigitalLicense struct {
	ID         uuid.UUID  `json:"id"`
	ProductID  uuid.UUID  `json:"product_id"`
	LicenseKey string     `json:"license_key"`
	IsSold     bool       `json:"is_sold"`
	SoldAt     *time.Time `json:"sold_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}
