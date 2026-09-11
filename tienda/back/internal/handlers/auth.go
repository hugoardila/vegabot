package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"time"

	"punto_de_venta_api/internal/db"
	"punto_de_venta_api/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type registerRequest struct {
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Phone    string `json:"phone"`
	Role     string `json:"role"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// POST /api/auth/register
func Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.FullName == "" || req.Email == "" || req.Password == "" {
		jsonError(w, "full_name, email and password are required", http.StatusBadRequest)
		return
	}
	if req.Phone != "" && len(req.Phone) != 10 {
		jsonError(w, "El teléfono debe tener 10 dígitos", http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonError(w, "error processing password", http.StatusInternalServerError)
		return
	}

	var user models.User
	err = db.Pool.QueryRow(context.Background(),
		`INSERT INTO users (full_name, email, password_hash, phone)
		 VALUES ($1, $2, $3, NULLIF($4,''))
		 RETURNING id, full_name, email, phone, id_number, role, status, created_at, updated_at`,
		req.FullName, req.Email, string(hash), req.Phone,
	).Scan(&user.ID, &user.FullName, &user.Email, &user.Phone, &user.IDNumber, &user.Role, &user.Status, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		jsonError(w, "El correo electrónico ya está registrado en el sistema.", http.StatusConflict)
		return
	}

	w.WriteHeader(http.StatusCreated)
	jsonResponse(w, user)
}

// POST /api/users/create-admin (solo super_admin)
func CreateAdmin(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.FullName == "" || req.Email == "" || req.Password == "" {
		jsonError(w, "full_name, email and password are required", http.StatusBadRequest)
		return
	}
	if req.Phone != "" && len(req.Phone) != 10 {
		jsonError(w, "El teléfono debe tener 10 dígitos", http.StatusBadRequest)
		return
	}

	// Force role to admin
	req.Role = "admin"

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonError(w, "error processing password", http.StatusInternalServerError)
		return
	}

	var user models.User
	err = db.Pool.QueryRow(context.Background(),
		`INSERT INTO users (full_name, email, password_hash, phone, role)
		 VALUES ($1, $2, $3, NULLIF($4,''), $5::user_role)
		 RETURNING id, full_name, email, phone, id_number, role, status, created_at, updated_at`,
		req.FullName, req.Email, string(hash), req.Phone, req.Role,
	).Scan(&user.ID, &user.FullName, &user.Email, &user.Phone, &user.IDNumber, &user.Role, &user.Status, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		jsonError(w, "El correo electrónico ya está registrado en el sistema.", http.StatusConflict)
		return
	}

	w.WriteHeader(http.StatusCreated)
	jsonResponse(w, user)
}

// POST /api/auth/login
func Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	var user models.User
	var passwordHash string
	err := db.Pool.QueryRow(context.Background(),
		`SELECT id, full_name, email, phone, id_number, password_hash, role, status FROM users WHERE email = $1`,
		req.Email,
	).Scan(&user.ID, &user.FullName, &user.Email, &user.Phone, &user.IDNumber, &passwordHash, &user.Role, &user.Status)

	if err != nil {
		jsonError(w, "invalid email or password", http.StatusUnauthorized)
		return
	}

	if !user.Status {
		jsonError(w, "Tu cuenta ha sido desactivada por motivos de seguridad. Por favor, contáctanos a nuestro WhatsApp de soporte para más información.", http.StatusForbidden)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		jsonError(w, "invalid email or password", http.StatusUnauthorized)
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID.String(),
		"role":    string(user.Role),
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
	})

	secret := os.Getenv("JWT_SECRET")
	tokenStr, err := token.SignedString([]byte(secret))
	if err != nil {
		jsonError(w, "error generating token", http.StatusInternalServerError)
		return
	}

	jsonResponse(w, map[string]interface{}{
		"token": tokenStr,
		"user":  user,
	})
}

// ─── Helpers ────────────────────────────────────────────────────────────────

func jsonResponse(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
