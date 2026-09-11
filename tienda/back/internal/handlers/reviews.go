package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"punto_de_venta_api/internal/db"
	"punto_de_venta_api/internal/middleware"
	"punto_de_venta_api/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// GET /api/products/:id/reviews
func GetProductReviews(w http.ResponseWriter, r *http.Request) {
	productIDStr := chi.URLParam(r, "id")
	productID, err := uuid.Parse(productIDStr)
	if err != nil {
		jsonError(w, "invalid product id", http.StatusBadRequest)
		return
	}

	rows, err := db.Pool.Query(context.Background(),
		`SELECT pr.id, pr.product_id, pr.user_id,
		        COALESCE(u.full_name, pr.reviewer_name) as reviewer_name,
		        pr.rating, COALESCE(pr.comment,''), pr.created_at
		 FROM product_reviews pr
		 LEFT JOIN users u ON pr.user_id = u.id
		 WHERE pr.product_id = $1 ORDER BY pr.created_at DESC`, productID)
	if err != nil {
		jsonError(w, "error fetching reviews", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var reviews []models.Review
	for rows.Next() {
		var rev models.Review
		if err := rows.Scan(&rev.ID, &rev.ProductID, &rev.UserID, &rev.ReviewerName, &rev.Rating, &rev.Comment, &rev.CreatedAt); err != nil {
			continue
		}
		reviews = append(reviews, rev)
	}
	if reviews == nil {
		reviews = []models.Review{}
	}
	jsonResponse(w, reviews)
}

// POST /api/products/:id/reviews
func CreateProductReview(w http.ResponseWriter, r *http.Request) {
	productIDStr := chi.URLParam(r, "id")
	productID, err := uuid.Parse(productIDStr)
	if err != nil {
		jsonError(w, "invalid product id", http.StatusBadRequest)
		return
	}

	var req struct {
		Rating  int    `json:"rating"`
		Comment string `json:"comment"`
		Name    string `json:"reviewer_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}
	if req.Rating < 1 || req.Rating > 5 {
		jsonError(w, "rating must be between 1 and 5", http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		req.Name = "Anónimo"
	}

	var userID *uuid.UUID
	if ctxUserID := r.Context().Value(middleware.UserIDKey); ctxUserID != nil {
		id := ctxUserID.(uuid.UUID)
		userID = &id

		var fullName string
		err := db.Pool.QueryRow(context.Background(), "SELECT full_name FROM users WHERE id = $1", id).Scan(&fullName)
		if err == nil && fullName != "" {
			req.Name = fullName
		}
	}

	var rev models.Review
	err = db.Pool.QueryRow(context.Background(),
		`INSERT INTO product_reviews (product_id, user_id, reviewer_name, rating, comment)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (product_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = CURRENT_TIMESTAMP
		 RETURNING id, product_id, user_id, reviewer_name, rating, COALESCE(comment,''), created_at`,
		productID, userID, req.Name, req.Rating, req.Comment,
	).Scan(&rev.ID, &rev.ProductID, &rev.UserID, &rev.ReviewerName, &rev.Rating, &rev.Comment, &rev.CreatedAt)
	if err != nil {
		jsonError(w, "error saving review: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	jsonResponse(w, rev)
}

// DELETE /api/reviews/:id
func DeleteProductReview(w http.ResponseWriter, r *http.Request) {
	reviewIDStr := chi.URLParam(r, "id")
	reviewID, err := uuid.Parse(reviewIDStr)
	if err != nil {
		jsonError(w, "invalid review id", http.StatusBadRequest)
		return
	}

	userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	userRole := r.Context().Value(middleware.UserRoleKey).(string)

	if userRole != "admin" && userRole != "super_admin" {
		var ownerID uuid.UUID
		err := db.Pool.QueryRow(context.Background(), "SELECT user_id FROM product_reviews WHERE id = $1", reviewID).Scan(&ownerID)
		if err != nil {
			jsonError(w, "review not found", http.StatusNotFound)
			return
		}
		if ownerID != userID {
			jsonError(w, "unauthorized", http.StatusForbidden)
			return
		}
	}

	_, err = db.Pool.Exec(context.Background(), "DELETE FROM product_reviews WHERE id = $1", reviewID)
	if err != nil {
		jsonError(w, "error deleting review", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
