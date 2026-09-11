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
	"google.golang.org/api/idtoken"
)

type googleLoginRequest struct {
	Token string `json:"token"`
}

// POST /api/auth/google
func GoogleLogin(w http.ResponseWriter, r *http.Request) {
	var req googleLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	if clientID == "" {
		jsonError(w, "google client id not configured", http.StatusInternalServerError)
		return
	}

	payload, err := idtoken.Validate(context.Background(), req.Token, clientID)
	if err != nil {
		jsonError(w, "invalid google token: "+err.Error(), http.StatusUnauthorized)
		return
	}

	email := payload.Claims["email"].(string)
	name := payload.Claims["name"].(string)
	googleID := payload.Subject

	// Step 1: Try to find existing user by email
	var user models.User
	var isNewUser bool = false
	
	err = db.Pool.QueryRow(context.Background(),
		`SELECT id, full_name, email, google_id, phone, id_number, role, status
		 FROM users WHERE email = $1`, email,
	).Scan(&user.ID, &user.FullName, &user.Email, &user.GoogleID, &user.Phone, &user.IDNumber, &user.Role, &user.Status)

	if err != nil {
		// User does not exist — create new user
		isNewUser = true
		err = db.Pool.QueryRow(context.Background(),
			`INSERT INTO users (full_name, email, google_id, role)
			 VALUES ($1, $2, $3, 'cliente')
			 RETURNING id, full_name, email, google_id, phone, id_number, role, status`,
			name, email, googleID,
		).Scan(&user.ID, &user.FullName, &user.Email, &user.GoogleID, &user.Phone, &user.IDNumber, &user.Role, &user.Status)

		if err != nil {
			jsonError(w, "Error al crear usuario con Google: "+err.Error(), http.StatusInternalServerError)
			return
		}
	} else {
		// User exists — update google_id if needed
		_, _ = db.Pool.Exec(context.Background(),
			`UPDATE users SET google_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
			googleID, user.ID)
	}

	if !user.Status {
		jsonError(w, "Tu cuenta ha sido desactivada por motivos de seguridad. Por favor, contáctanos a nuestro WhatsApp de soporte para más información.", http.StatusForbidden)
		return
	}

	// Generate JWT
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
		"token":       tokenStr,
		"user":        user,
		"is_new_user": isNewUser,
	})
}
