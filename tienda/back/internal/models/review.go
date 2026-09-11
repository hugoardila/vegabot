package models

import (
	"github.com/google/uuid"
	"time"
)

type Review struct {
	ID           uuid.UUID  `json:"id"`
	ProductID    uuid.UUID  `json:"product_id"`
	UserID       *uuid.UUID `json:"user_id,omitempty"`
	ReviewerName string     `json:"reviewer_name"`
	Rating       int        `json:"rating"`
	Comment      string     `json:"comment"`
	CreatedAt    time.Time  `json:"created_at"`
}
