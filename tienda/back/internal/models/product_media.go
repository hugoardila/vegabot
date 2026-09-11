package models

import (
	"github.com/google/uuid"
	"time"
)

type ProductMedia struct {
	ID        uuid.UUID `json:"id"`
	ProductID uuid.UUID `json:"product_id"`
	URL       string    `json:"url"`
	MediaType *string   `json:"media_type,omitempty"`
	IsMain    bool      `json:"is_main"`
	CreatedAt time.Time `json:"created_at"`
}
