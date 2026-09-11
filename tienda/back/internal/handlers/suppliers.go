package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"punto_de_venta_api/internal/db"
	"punto_de_venta_api/internal/models"
)

// GetSuppliers obtiene todos los proveedores
func GetSuppliers(w http.ResponseWriter, r *http.Request) {
	fmt.Println("📋 Obteniendo lista de proveedores...")

	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, name, contact_name, address, city, phone, created_at, updated_at
		FROM suppliers
		ORDER BY created_at DESC
	`)
	if err != nil {
		fmt.Printf("❌ Error al consultar suppliers: %v\n", err)
		http.Error(w, `{"error": "Error al obtener proveedores"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	suppliers := []models.Supplier{}
	for rows.Next() {
		var s models.Supplier
		err := rows.Scan(&s.ID, &s.Name, &s.ContactName, &s.Address, &s.City, &s.Phone, &s.CreatedAt, &s.UpdatedAt)
		if err != nil {
			fmt.Printf("⚠️ Error escaneando fila: %v\n", err)
			continue
		}
		suppliers = append(suppliers, s)
	}

	fmt.Printf("✅ Se encontraron %d proveedores\n", len(suppliers))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(suppliers)
}

// GetSupplierByID obtiene un proveedor por ID
func GetSupplierByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var s models.Supplier
	err := db.Pool.QueryRow(context.Background(), `
		SELECT id, name, contact_name, address, city, phone, created_at, updated_at
		FROM suppliers
		WHERE id = $1
	`, id).Scan(&s.ID, &s.Name, &s.ContactName, &s.Address, &s.City, &s.Phone, &s.CreatedAt, &s.UpdatedAt)

	if err == sql.ErrNoRows {
		http.Error(w, `{"error": "Proveedor no encontrado"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, `{"error": "Error al obtener proveedor"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

// CreateSupplier crea un nuevo proveedor
func CreateSupplier(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("❌ PANIC en CreateSupplier: %v\n", r)
			http.Error(w, `{"error": "Error interno del servidor"}`, http.StatusInternalServerError)
		}
	}()

	var req models.CreateSupplierRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fmt.Printf("❌ Error decodificando JSON: %v\n", err)
		http.Error(w, `{"error": "Datos inválidos"}`, http.StatusBadRequest)
		return
	}

	fmt.Printf("📥 Datos recibidos: %+v\n", req)
	fmt.Printf("📥 Name: '%s', ContactName: %v, Address: %v, City: %v, Phone: %v\n", 
		req.Name, req.ContactName, req.Address, req.City, req.Phone)

	var supplierID uuid.UUID
	err := db.Pool.QueryRow(context.Background(), `
		INSERT INTO suppliers (name, contact_name, address, city, phone)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, req.Name, req.ContactName, req.Address, req.City, req.Phone).Scan(&supplierID)

	if err != nil {
		fmt.Printf("❌ Error en base de datos: %v\n", err)
		http.Error(w, `{"error": "Error al crear proveedor"}`, http.StatusInternalServerError)
		return
	}

	fmt.Printf("✅ Proveedor creado con ID: %s\n", supplierID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": supplierID, "message": "Proveedor creado exitosamente"})
}

// UpdateSupplier actualiza un proveedor existente
func UpdateSupplier(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req models.UpdateSupplierRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Datos inválidos"}`, http.StatusBadRequest)
		return
	}

	// Construir query dinámica
	query := "UPDATE suppliers SET updated_at = $1"
	args := []interface{}{time.Now()}
	argCount := 1

	if req.Name != nil {
		argCount++
		query += fmt.Sprintf(", name = $%d", argCount)
		args = append(args, *req.Name)
	}
	if req.ContactName != nil {
		argCount++
		query += fmt.Sprintf(", contact_name = $%d", argCount)
		args = append(args, *req.ContactName)
	}
	if req.Address != nil {
		argCount++
		query += fmt.Sprintf(", address = $%d", argCount)
		args = append(args, *req.Address)
	}
	if req.City != nil {
		argCount++
		query += fmt.Sprintf(", city = $%d", argCount)
		args = append(args, *req.City)
	}
	if req.Phone != nil {
		argCount++
		query += fmt.Sprintf(", phone = $%d", argCount)
		args = append(args, *req.Phone)
	}

	argCount++
	query += fmt.Sprintf(" WHERE id = $%d", argCount)
	args = append(args, id)

	result, err := db.Pool.Exec(context.Background(), query, args...)
	if err != nil {
		http.Error(w, `{"error": "Error al actualizar proveedor"}`, http.StatusInternalServerError)
		return
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, `{"error": "Proveedor no encontrado"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Proveedor actualizado exitosamente"})
}

// DeleteSupplier elimina un proveedor
func DeleteSupplier(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	result, err := db.Pool.Exec(context.Background(), "DELETE FROM suppliers WHERE id = $1", id)
	if err != nil {
		http.Error(w, `{"error": "Error al eliminar proveedor"}`, http.StatusInternalServerError)
		return
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, `{"error": "Proveedor no encontrado"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Proveedor eliminado exitosamente"})
}
