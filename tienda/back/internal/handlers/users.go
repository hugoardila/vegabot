package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"

	"punto_de_venta_api/internal/db"
	"punto_de_venta_api/internal/middleware"
	"punto_de_venta_api/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// GET /api/users
func GetUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Pool.Query(context.Background(),
		`SELECT id, full_name, email, phone, id_number, role, status, created_at, updated_at FROM users ORDER BY id LIMIT 200`)
	if err != nil {
		jsonError(w, "error fetching users", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.FullName, &u.Email, &u.Phone, &u.IDNumber, &u.Role, &u.Status, &u.CreatedAt, &u.UpdatedAt); err != nil {
			continue
		}
		users = append(users, u)
	}
	if users == nil {
		users = []models.User{}
	}
	jsonResponse(w, users)
}

// GET /api/users/:id
func GetUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	var u models.User
	err = db.Pool.QueryRow(context.Background(),
		`SELECT id, full_name, email, phone, id_number, role, status, created_at, updated_at FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.FullName, &u.Email, &u.Phone, &u.IDNumber, &u.Role, &u.Status, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		jsonError(w, "user not found", http.StatusNotFound)
		return
	}
	jsonResponse(w, u)
}

// PUT /api/users/:id
func UpdateUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	// Obtener rol del usuario actual
	currentUserRole, ok := r.Context().Value(middleware.UserRoleKey).(string)
	if !ok {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Obtener el rol del usuario que se va a actualizar
	var targetUserRole string
	err = db.Pool.QueryRow(context.Background(),
		`SELECT role FROM users WHERE id = $1`, id,
	).Scan(&targetUserRole)
	if err != nil {
		jsonError(w, "user not found", http.StatusNotFound)
		return
	}

	// Si el usuario actual es admin (no super_admin), no puede modificar a otros admin o super_admin
	if currentUserRole == "admin" && (targetUserRole == "admin" || targetUserRole == "super_admin") {
		jsonError(w, "No tienes permisos para modificar administradores", http.StatusForbidden)
		return
	}

	var body struct {
		FullName string `json:"full_name"`
		Email    string `json:"email"`
		Status   *bool  `json:"status"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Validar formato de email si se proporciona
	if body.Email != "" {
		emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
		if !emailRegex.MatchString(body.Email) {
			jsonError(w, "formato de email inválido", http.StatusBadRequest)
			return
		}
	}

	// Si se envía password, hashearla
	var passwordHash interface{}
	if body.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
		if err != nil {
			jsonError(w, "error processing password", http.StatusInternalServerError)
			return
		}
		passwordHash = string(hash)
	}

	_, err = db.Pool.Exec(context.Background(),
		`UPDATE users SET full_name = COALESCE(NULLIF($1,''), full_name),
		 email = COALESCE(NULLIF($2,''), email),
		 status = COALESCE($3, status),
		 password_hash = COALESCE(NULLIF($4,''), password_hash),
		 updated_at = NOW()
		 WHERE id = $5`,
		body.FullName, body.Email, body.Status, passwordHash, id,
	)
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "users_email_key") || strings.Contains(errMsg, "email") {
			jsonError(w, "Ese Correo Electrónico ya está registrado en otra cuenta.", http.StatusConflict)
		} else {
			jsonError(w, "error updating user: "+errMsg, http.StatusInternalServerError)
		}
		return
	}
	jsonResponse(w, map[string]string{"message": "user updated"})
}

// PUT /api/profile
func UpdateProfile(w http.ResponseWriter, r *http.Request) {
	// Obtener ID del contexto (puesto por el middleware Auth)
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var body struct {
		FullName string `json:"full_name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Phone    string `json:"phone"`
		IDNumber string `json:"id_number"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Validar formato de email si se proporciona
	if body.Email != "" {
		emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
		if !emailRegex.MatchString(body.Email) {
			jsonError(w, "formato de email inválido", http.StatusBadRequest)
			return
		}
	}

	// Si hay password, hashear
	var passwordArg interface{}
	if body.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
		if err != nil {
			jsonError(w, "error processing password", http.StatusInternalServerError)
			return
		}
		passwordArg = string(hash)
	}

	_, err := db.Pool.Exec(context.Background(),
		`UPDATE users SET 
		 full_name = COALESCE(NULLIF($1,''), full_name),
		 email = COALESCE(NULLIF($2,''), email),
		 password_hash = COALESCE(NULLIF($3,''), password_hash),
		 phone = COALESCE(NULLIF($4,''), phone),
		 id_number = COALESCE(NULLIF($5,''), id_number),
		 updated_at = NOW()
		 WHERE id = $6`,
		body.FullName, body.Email, passwordArg, body.Phone, body.IDNumber, userID,
	)
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "users_email_key") || strings.Contains(errMsg, "email") {
			jsonError(w, "Ese Correo Electrónico ya está registrado. Usa uno diferente.", http.StatusConflict)
		} else {
			jsonError(w, "Error al actualizar perfil: "+errMsg, http.StatusInternalServerError)
		}
		return
	}

	// Obtener y retornar el usuario actualizado
	var updatedUser models.User
	err = db.Pool.QueryRow(context.Background(),
		`SELECT id, full_name, email, phone, id_number, role, status, created_at, updated_at
		 FROM users WHERE id = $1`, userID,
	).Scan(&updatedUser.ID, &updatedUser.FullName, &updatedUser.Email, &updatedUser.Phone, 
		&updatedUser.IDNumber, &updatedUser.Role, &updatedUser.Status, &updatedUser.CreatedAt, &updatedUser.UpdatedAt)
	
	if err != nil {
		jsonError(w, "Error al obtener usuario actualizado", http.StatusInternalServerError)
		return
	}

	jsonResponse(w, map[string]interface{}{
		"message": "profile updated successfully",
		"user": updatedUser,
	})
}

// DELETE /api/users/:id  (desactiva, no elimina)
func DeleteUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	_, err = db.Pool.Exec(context.Background(),
		`UPDATE users SET status = FALSE, updated_at = NOW() WHERE id = $1`, id)
	if err != nil {
		jsonError(w, "error disabling user", http.StatusInternalServerError)
		return
	}
	jsonResponse(w, map[string]string{"message": "user disabled"})
}
