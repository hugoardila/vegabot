package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"punto_de_venta_api/internal/db"
	"punto_de_venta_api/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// GET /api/categories
func GetCategories(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Pool.Query(context.Background(),
		`SELECT id, name, COALESCE(description, ''), COALESCE(icon, ''), created_at
		 FROM categories ORDER BY id`)
	if err != nil {
		jsonError(w, "error fetching categories", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var cats []models.Category
	for rows.Next() {
		var c models.Category
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.Icon, &c.CreatedAt); err != nil {
			continue
		}
		cats = append(cats, c)
	}
	if cats == nil {
		cats = []models.Category{}
	}
	jsonResponse(w, cats)
}

// POST /api/categories
func CreateCategory(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Icon        string `json:"icon"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		jsonError(w, "name is required", http.StatusBadRequest)
		return
	}
	if body.Icon == "" {
		body.Icon = "📁"
	}

	var cat models.Category
	err := db.Pool.QueryRow(context.Background(),
		`INSERT INTO categories (name, description, icon)
		 VALUES ($1, NULLIF($2,''), $3)
		 RETURNING id, name, COALESCE(description,''), COALESCE(icon,''), created_at`,
		body.Name, body.Description, body.Icon,
	).Scan(&cat.ID, &cat.Name, &cat.Description, &cat.Icon, &cat.CreatedAt)
	if err != nil {
		jsonError(w, "error creating category: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	jsonResponse(w, cat)
}

// PUT /api/categories/:id  — returns the full updated category
func UpdateCategory(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Icon        string `json:"icon"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}

	var cat models.Category
	err = db.Pool.QueryRow(context.Background(),
		`UPDATE categories
		 SET name        = CASE WHEN $1 <> '' THEN $1 ELSE name END,
		     description = CASE WHEN $2 <> '' THEN $2 ELSE description END,
		     icon        = CASE WHEN $3 <> '' THEN $3 ELSE icon END
		 WHERE id = $4
		 RETURNING id, name, COALESCE(description,''), COALESCE(icon,''), created_at`,
		body.Name, body.Description, body.Icon, id,
	).Scan(&cat.ID, &cat.Name, &cat.Description, &cat.Icon, &cat.CreatedAt)
	if err != nil {
		jsonError(w, "error updating category: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonResponse(w, cat)
}

// DELETE /api/categories/:id
func DeleteCategory(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	_, err = db.Pool.Exec(context.Background(), `DELETE FROM categories WHERE id = $1`, id)
	if err != nil {
		jsonError(w, "error deleting category", http.StatusInternalServerError)
		return
	}
	jsonResponse(w, map[string]string{"message": "category deleted"})
}
