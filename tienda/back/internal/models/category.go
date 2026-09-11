package models

import (
	"github.com/google/uuid"
	"time"
)

type Category struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	Icon        string    `json:"icon"`
	CreatedAt   time.Time `json:"created_at"`
}
