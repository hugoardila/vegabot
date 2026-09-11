package models

import (
	"github.com/google/uuid"
	"time"
)

type Sale struct {
	ID                    uuid.UUID  `json:"id"`
	CustomerID            *uuid.UUID `json:"customer_id,omitempty"`
	CustomerName          *string    `json:"customer_name,omitempty"`
	CustomerEmail         *string    `json:"customer_email,omitempty"`
	TotalAmount           float64    `json:"total_amount"`
	CustomerPhone         string     `json:"customer_phone"`
	CustomerIDNumber     *string    `json:"customer_id_number,omitempty"`
	DeliveryAddress       *string    `json:"delivery_address,omitempty"`
	DeliveryCountry       *string    `json:"delivery_country,omitempty"`
	DeliveryDepartment    *string    `json:"delivery_department,omitempty"`
	DeliveryCity          *string    `json:"delivery_city,omitempty"`
	DeliveryAdditionalInfo *string   `json:"delivery_additional_info,omitempty"`
	PaymentMethod         *string    `json:"payment_method,omitempty"`
	WhatsappSentCustomer  bool       `json:"whatsapp_sent_customer"`
	WhatsappSentAdmin     bool       `json:"whatsapp_sent_admin"`
	Status                string     `json:"status"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
	Items                 []SaleItem `json:"items,omitempty"`
	Receipts              []string   `json:"receipts,omitempty"`
}

type SaleItem struct {
	ID          uuid.UUID `json:"id"`
	SaleID      uuid.UUID `json:"sale_id"`
	ProductID   uuid.UUID `json:"product_id"`
	ProductName string    `json:"product_name,omitempty"`
	Quantity    int       `json:"quantity"`
	UnitPrice   float64   `json:"unit_price"`
	Subtotal    float64   `json:"subtotal"`
}
