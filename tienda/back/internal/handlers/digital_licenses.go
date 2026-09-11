package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"punto_de_venta_api/internal/db"
	"punto_de_venta_api/internal/models"

	"github.com/go-chi/chi/v5"
)

// GET /api/products/:id/licenses  (admin)
func GetLicenses(w http.ResponseWriter, r *http.Request) {
	productID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		jsonError(w, "invalid product id", http.StatusBadRequest)
		return
	}

	rows, err := db.Pool.Query(context.Background(),
		`SELECT id, product_id, license_key, is_sold, sold_at, created_at FROM digital_licenses WHERE product_id = $1 ORDER BY id`,
		productID)
	if err != nil {
		jsonError(w, "error fetching licenses", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var licenses []models.DigitalLicense
	for rows.Next() {
		var l models.DigitalLicense
		if err := rows.Scan(&l.ID, &l.ProductID, &l.LicenseKey, &l.IsSold, &l.SoldAt, &l.CreatedAt); err != nil {
			continue
		}
		licenses = append(licenses, l)
	}
	if licenses == nil {
		licenses = []models.DigitalLicense{}
	}
	jsonResponse(w, licenses)
}

// POST /api/products/:id/licenses  (admin)
func AddLicense(w http.ResponseWriter, r *http.Request) {
	productID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		jsonError(w, "invalid product id", http.StatusBadRequest)
		return
	}

	var body struct {
		LicenseKey string `json:"license_key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.LicenseKey == "" {
		jsonError(w, "license_key is required", http.StatusBadRequest)
		return
	}

	var l models.DigitalLicense
	err = db.Pool.QueryRow(context.Background(),
		`INSERT INTO digital_licenses (product_id, license_key) VALUES ($1, $2)
		 RETURNING id, product_id, license_key, is_sold, sold_at, created_at`,
		productID, body.LicenseKey,
	).Scan(&l.ID, &l.ProductID, &l.LicenseKey, &l.IsSold, &l.SoldAt, &l.CreatedAt)
	if err != nil {
		jsonError(w, "license_key already exists or error", http.StatusConflict)
		return
	}
	w.WriteHeader(http.StatusCreated)
	jsonResponse(w, l)
}
