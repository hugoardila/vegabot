package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"punto_de_venta_api/internal/db"
	"punto_de_venta_api/internal/filestore"
	"punto_de_venta_api/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// GET /api/products  (soporta ?category_id=N&status=true)
func GetProducts(w http.ResponseWriter, r *http.Request) {
	query := `SELECT p.id, p.category_id, COALESCE(c.name, ''), p.name, p.description, p.price, p.stock, p.is_digital, p.sku, p.status, 
	          (SELECT COALESCE(array_agg(url), '{}') FROM product_media WHERE product_id = p.id) as images,
	          p.created_at, p.updated_at
	          FROM products p 
	          LEFT JOIN categories c ON p.category_id = c.id
	          WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if catIDStr := r.URL.Query().Get("category_id"); catIDStr != "" {
		catID, err := uuid.Parse(catIDStr)
		if err != nil {
			jsonError(w, "invalid category id", http.StatusBadRequest)
			return
		}
		query += ` AND p.category_id = $` + strconv.Itoa(argIdx)
		args = append(args, catID)
		argIdx++
	}
	if status := r.URL.Query().Get("status"); status != "" {
		query += ` AND p.status = $` + strconv.Itoa(argIdx)
		args = append(args, status == "true")
		argIdx++
	}
	query += ` ORDER BY p.id LIMIT 200`

	rows, err := db.Pool.Query(context.Background(), query, args...)
	if err != nil {
		jsonError(w, "error fetching products: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var prods []models.Product
	for rows.Next() {
		var p models.Product
		if err := rows.Scan(&p.ID, &p.CategoryID, &p.CategoryName, &p.Name, &p.Description, &p.Price, &p.Stock, &p.IsDigital, &p.SKU, &p.Status, &p.Images, &p.CreatedAt, &p.UpdatedAt); err != nil {
			continue
		}
		prods = append(prods, p)
	}
	if prods == nil {
		prods = []models.Product{}
	}
	jsonResponse(w, prods)
}

// GET /api/products/:id
func GetProduct(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	var p models.Product
	err = db.Pool.QueryRow(context.Background(),
		`SELECT p.id, p.category_id, COALESCE(c.name, ''), p.name, p.description, p.price, p.stock, p.is_digital, p.sku, p.status, 
		 (SELECT COALESCE(array_agg(url), '{}') FROM product_media WHERE product_id = p.id) as images,
		 p.created_at, p.updated_at 
		 FROM products p 
		 LEFT JOIN categories c ON p.category_id = c.id
		 WHERE p.id = $1`, id,
	).Scan(&p.ID, &p.CategoryID, &p.CategoryName, &p.Name, &p.Description, &p.Price, &p.Stock, &p.IsDigital, &p.SKU, &p.Status, &p.Images, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		jsonError(w, "product not found", http.StatusNotFound)
		return
	}
	jsonResponse(w, p)
}

// POST /api/products
func CreateProduct(w http.ResponseWriter, r *http.Request) {
	var body struct {
		CategoryID  *uuid.UUID `json:"category_id"`
		Name        string     `json:"name"`
		Description *string    `json:"description"`
		Price       float64    `json:"price"`
		Stock       int        `json:"stock"`
		IsDigital   bool       `json:"is_digital"`
		SKU         *string    `json:"sku"`
		Images      []string   `json:"images"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" || body.Price <= 0 {
		jsonError(w, "name and price are required", http.StatusBadRequest)
		return
	}

	tx, err := db.Pool.Begin(context.Background())
	if err != nil {
		jsonError(w, "error starting transaction", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(context.Background())

	var p models.Product
	err = tx.QueryRow(context.Background(),
		`INSERT INTO products (category_id, name, description, price, stock, is_digital, sku)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 RETURNING id, category_id, name, description, price, stock, is_digital, sku, status, created_at, updated_at`,
		body.CategoryID, body.Name, body.Description, body.Price, body.Stock, body.IsDigital, body.SKU,
	).Scan(&p.ID, &p.CategoryID, &p.Name, &p.Description, &p.Price, &p.Stock, &p.IsDigital, &p.SKU, &p.Status, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		jsonError(w, "error creating product: "+err.Error(), http.StatusInternalServerError)
		return
	}

	for i, imgUrl := range body.Images {
		if imgUrl == "" {
			continue
		}
		isMain := (i == 0)
		_, err = tx.Exec(context.Background(), `INSERT INTO product_media (product_id, url, is_main) VALUES ($1,$2,$3)`, p.ID, imgUrl, isMain)
		if err != nil {
			jsonError(w, "error adding product media", http.StatusInternalServerError)
			return
		}
	}
	err = tx.Commit(context.Background())
	if err != nil {
		jsonError(w, "error committing transaction", http.StatusInternalServerError)
		return
	}
	p.Images = body.Images
	w.WriteHeader(http.StatusCreated)
	jsonResponse(w, p)
}

// PUT /api/products/:id
func UpdateProduct(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	var body struct {
		CategoryID  *uuid.UUID `json:"category_id"`
		Name        string     `json:"name"`
		Description *string    `json:"description"`
		Price       *float64   `json:"price"`
		Stock       *int       `json:"stock"`
		IsDigital   *bool      `json:"is_digital"`
		SKU         *string    `json:"sku"`
		Status      *bool      `json:"status"`
		Images      []string   `json:"images"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}

	tx, err := db.Pool.Begin(context.Background())
	if err != nil {
		jsonError(w, "error starting transaction", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(context.Background())

	_, err = tx.Exec(context.Background(),
		`UPDATE products SET
		 category_id = COALESCE($1, category_id),
		 name = COALESCE(NULLIF($2,''), name),
		 description = COALESCE($3, description),
		 price = COALESCE($4, price),
		 stock = COALESCE($5, stock),
		 is_digital = COALESCE($6, is_digital),
		 sku = COALESCE($7, sku),
		 status = COALESCE($8, status),
		 updated_at = NOW()
		 WHERE id = $9`,
		body.CategoryID, body.Name, body.Description, body.Price, body.Stock, body.IsDigital, body.SKU, body.Status, id)
	if err != nil {
		jsonError(w, "error updating product", http.StatusInternalServerError)
		return
	}

	if body.Images != nil {
		// Obtener las URLs de los archivos actuales ANTES de borrar los registros.
		// Esto es necesario para poder eliminar los archivos físicos del SSD
		// y evitar que queden archivos "fantasma" acumulando espacio.
		oldRows, err := tx.Query(context.Background(),
			`SELECT url FROM product_media WHERE product_id = $1`, id)
		if err != nil {
			jsonError(w, "error al consultar media anterior", http.StatusInternalServerError)
			return
		}
		var oldURLs []string
		for oldRows.Next() {
			var u string
			if scanErr := oldRows.Scan(&u); scanErr == nil && u != "" {
				oldURLs = append(oldURLs, u)
			}
		}
		oldRows.Close()

		// Borrar los registros de BD dentro de la transacción
		_, err = tx.Exec(context.Background(),
			`DELETE FROM product_media WHERE product_id = $1`, id)
		if err != nil {
			jsonError(w, "error al eliminar media anterior", http.StatusInternalServerError)
			return
		}

		for i, imgUrl := range body.Images {
			if imgUrl == "" {
				continue
			}
			isMain := (i == 0)
			_, err = tx.Exec(context.Background(),
				`INSERT INTO product_media (product_id, url, is_main) VALUES ($1,$2,$3)`,
				id, imgUrl, isMain)
			if err != nil {
				jsonError(w, "error al agregar nuevo media", http.StatusInternalServerError)
				return
			}
		}

		// Commit primero, luego borrar físicamente.
		// Si el commit falla, no borramos nada del disco.
		if err = tx.Commit(context.Background()); err != nil {
			jsonError(w, "error al confirmar la transacción", http.StatusInternalServerError)
			return
		}

		// Eliminar archivos físicos del SSD DESPUÉS de confirmar la BD.
		// os.Remove → syscall unlink → libera bloques en el SSD inmediatamente.
		for _, oldURL := range oldURLs {
			if err := filestore.RemoveFileIgnoreNotFound(oldURL); err != nil {
				log.Printf("[UpdateProduct] WARN: no se pudo borrar archivo físico %s: %v", oldURL, err)
			}
		}

		jsonResponse(w, map[string]string{"message": "producto actualizado"})
		return
	}

	if err = tx.Commit(context.Background()); err != nil {
		jsonError(w, "error al confirmar la transacción", http.StatusInternalServerError)
		return
	}

	jsonResponse(w, map[string]string{"message": "producto actualizado"})
}

// DELETE /api/products/:id — eliminación FÍSICA completa del producto y sus archivos.
//
// Orden de operaciones:
//  1. Recopilar las URLs de todos los archivos del producto desde product_media.
//  2. Ejecutar DELETE en product_media y products dentro de una transacción.
//  3. Si la transacción hace commit, eliminar los archivos físicos del SSD.
//
// Este orden garantiza consistencia: si la BD falla, el disco no se toca.
// Si el disco falla, el registro ya no existe en BD (frontend no puede acceder).
func DeleteProduct(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		jsonError(w, "id inválido", http.StatusBadRequest)
		return
	}

	// PASO 1: Recopilar las URLs de los archivos antes de borrar.
	rows, err := db.Pool.Query(context.Background(),
		`SELECT url FROM product_media WHERE product_id = $1`, id)
	if err != nil {
		jsonError(w, "error al consultar archivos del producto", http.StatusInternalServerError)
		return
	}
	var fileURLs []string
	for rows.Next() {
		var u string
		if scanErr := rows.Scan(&u); scanErr == nil && u != "" {
			fileURLs = append(fileURLs, u)
		}
	}
	rows.Close()

	// PASO 2: Eliminar registros de BD en una transacción.
	// product_media se borra primero por la FK que referencia a products.
	tx, err := db.Pool.Begin(context.Background())
	if err != nil {
		jsonError(w, "error al iniciar transacción", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(context.Background())

	if _, err = tx.Exec(context.Background(),
		`DELETE FROM product_media WHERE product_id = $1`, id); err != nil {
		jsonError(w, "error al eliminar media del producto", http.StatusInternalServerError)
		return
	}

	tag, err := tx.Exec(context.Background(),
		`DELETE FROM products WHERE id = $1`, id)
	if err != nil {
		jsonError(w, "error al eliminar el producto", http.StatusInternalServerError)
		return
	}
	if tag.RowsAffected() == 0 {
		jsonError(w, "producto no encontrado", http.StatusNotFound)
		return
	}

	if err = tx.Commit(context.Background()); err != nil {
		jsonError(w, "error al confirmar la eliminación", http.StatusInternalServerError)
		return
	}

	// PASO 3: Eliminar archivos físicos del SSD.
	// os.Remove ejecuta unlink() en Linux, liberando los bloques del inodo
	// inmediatamente en el volumen Docker mapeado al SSD físico.
	// Se ejecuta DESPUÉS del commit de BD para no dejar archivos fantasma
	// en caso de que la transacción de BD hubiera fallado.
	for _, fileURL := range fileURLs {
		if err := filestore.RemoveFileIgnoreNotFound(fileURL); err != nil {
			log.Printf("[DeleteProduct] WARN: no se pudo borrar archivo físico %s: %v", fileURL, err)
		}
	}

	jsonResponse(w, map[string]interface{}{
		"ok":      true,
		"message": "producto eliminado permanentemente",
		"id":      id,
	})
}
