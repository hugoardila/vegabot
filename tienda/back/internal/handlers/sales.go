package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"punto_de_venta_api/internal/db"
	"punto_de_venta_api/internal/middleware"
	"punto_de_venta_api/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type createSaleRequest struct {
	CustomerID             *uuid.UUID `json:"customer_id"`
	CustomerPhone          string     `json:"customer_phone"`
	CustomerIDNumber       string     `json:"customer_id_number"`
	DeliveryAddress        string     `json:"delivery_address"`
	DeliveryDepartment     string     `json:"delivery_department"`
	DeliveryCity           string     `json:"delivery_city"`
	DeliveryAdditionalInfo string     `json:"delivery_additional_info"`
	PaymentMethod          *string    `json:"payment_method"`
	Receipts               []string   `json:"receipts"`
	Items                  []struct {
		ProductID   uuid.UUID `json:"product_id"`
		ProductName string    `json:"product_name"`
		Quantity    int       `json:"quantity"`
		UnitPrice   float64   `json:"unit_price"`
	} `json:"items"`
}

// GET /api/sales
func GetSales(w http.ResponseWriter, r *http.Request) {
	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")
	statusFilter := r.URL.Query().Get("status")
	monthFilter := r.URL.Query().Get("month")
	searchQuery := r.URL.Query().Get("search")

	page := 1
	limit := 10
	if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
		page = p
	}
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}

	offset := (page - 1) * limit

	whereClauses := []string{"1=1"}
	var args []interface{}
	argId := 1

	if statusFilter != "" && statusFilter != "TODOS" {
		whereClauses = append(whereClauses, fmt.Sprintf("s.status = $%d", argId))
		args = append(args, statusFilter)
		argId++
	}

	if monthFilter != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("TO_CHAR(s.created_at, 'YYYY-MM') = $%d", argId))
		args = append(args, monthFilter)
		argId++
	}

	if searchQuery != "" {
		searchParam := "%" + searchQuery + "%"
		whereClauses = append(whereClauses, fmt.Sprintf("(s.id::text ILIKE $%d OR s.customer_phone ILIKE $%d OR s.status ILIKE $%d OR s.customer_email ILIKE $%d OR u.email ILIKE $%d)", argId, argId, argId, argId, argId))
		args = append(args, searchParam)
		argId++
	}

	whereQuery := strings.Join(whereClauses, " AND ")

	var total int
	countQuery := fmt.Sprintf(`SELECT count(*) FROM sales s LEFT JOIN users u ON u.id = s.customer_id WHERE %s`, whereQuery)
	err := db.Pool.QueryRow(context.Background(), countQuery, args...).Scan(&total)
	if err != nil {
		jsonError(w, "error counting sales", http.StatusInternalServerError)
		return
	}

	args = append(args, limit, offset)
	dataQuery := fmt.Sprintf(`
		SELECT s.id, s.customer_id, COALESCE(s.customer_name, u.full_name), COALESCE(s.customer_email, u.email), s.total_amount, s.customer_phone, s.customer_id_number,
		 s.delivery_address, s.delivery_country, s.delivery_department, s.delivery_city, s.delivery_additional_info,
		 s.payment_method, s.status,
		 s.whatsapp_sent_customer, s.whatsapp_sent_admin, s.created_at, s.updated_at, s.receipts
		FROM sales s
		LEFT JOIN users u ON u.id = s.customer_id
		WHERE %s
		ORDER BY s.created_at DESC
		LIMIT $%d OFFSET $%d`, whereQuery, argId, argId+1)

	rows, err := db.Pool.Query(context.Background(), dataQuery, args...)
	if err != nil {
		jsonError(w, "error fetching sales", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var sales []models.Sale
	for rows.Next() {
		var s models.Sale
		if err := rows.Scan(&s.ID, &s.CustomerID, &s.CustomerName, &s.CustomerEmail, &s.TotalAmount, &s.CustomerPhone, &s.CustomerIDNumber,
			&s.DeliveryAddress, &s.DeliveryCountry, &s.DeliveryDepartment, &s.DeliveryCity, &s.DeliveryAdditionalInfo,
			&s.PaymentMethod, &s.Status,
			&s.WhatsappSentCustomer, &s.WhatsappSentAdmin, &s.CreatedAt, &s.UpdatedAt, &s.Receipts); err != nil {
			continue
		}
		sales = append(sales, s)
	}
	if sales == nil {
		sales = []models.Sale{}
	}

	if len(sales) > 0 {
		saleIDs := make([]uuid.UUID, len(sales))
		for i, s := range sales {
			saleIDs[i] = s.ID
		}

		itemRows, err := db.Pool.Query(context.Background(),
			`SELECT id, sale_id, product_id, product_name, quantity, unit_price, subtotal 
			 FROM sale_items 
			 WHERE sale_id = ANY($1)
			 ORDER BY id`, saleIDs)
		if err == nil {
			defer itemRows.Close()
			itemsMap := make(map[uuid.UUID][]models.SaleItem)
			for itemRows.Next() {
				var item models.SaleItem
				if err := itemRows.Scan(&item.ID, &item.SaleID, &item.ProductID, &item.ProductName, &item.Quantity, &item.UnitPrice, &item.Subtotal); err == nil {
					itemsMap[item.SaleID] = append(itemsMap[item.SaleID], item)
				}
			}
			for i := range sales {
				if items, ok := itemsMap[sales[i].ID]; ok {
					sales[i].Items = items
				} else {
					sales[i].Items = []models.SaleItem{}
				}
			}
		}
	}

	statusCountsQuery := `SELECT status, COUNT(*) FROM sales GROUP BY status`
	statusRows, err := db.Pool.Query(context.Background(), statusCountsQuery)
	statusCounts := make(map[string]int)
	if err == nil {
		for statusRows.Next() {
			var st string
			var count int
			if err := statusRows.Scan(&st, &count); err == nil {
				statusCounts[st] = count
			}
		}
		statusRows.Close()
	}

	response := map[string]interface{}{
		"data":          sales,
		"total":         total,
		"page":          page,
		"limit":         limit,
		"status_counts": statusCounts,
	}
	jsonResponse(w, response)
}

// GET /api/sales/months
func GetSalesMonths(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Pool.Query(context.Background(), `SELECT DISTINCT TO_CHAR(created_at, 'YYYY-MM') as month FROM sales WHERE created_at IS NOT NULL ORDER BY month DESC`)
	if err != nil {
		jsonError(w, "error fetching months", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var months []string
	for rows.Next() {
		var m string
		if err := rows.Scan(&m); err == nil && m != "" {
			months = append(months, m)
		}
	}
	if months == nil {
		months = []string{}
	}
	jsonResponse(w, months)
}

// GET /api/sales/me
func GetMySales(w http.ResponseWriter, r *http.Request) {
	ctxUserID := r.Context().Value(middleware.UserIDKey)
	if ctxUserID == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	userID := ctxUserID.(uuid.UUID)

	rows, err := db.Pool.Query(context.Background(),
		`SELECT s.id, s.customer_id, COALESCE(s.customer_name, u.full_name), COALESCE(s.customer_email, u.email), s.total_amount, s.customer_phone, s.customer_id_number,
		 s.delivery_address, s.delivery_country, s.delivery_department, s.delivery_city, s.delivery_additional_info,
		 s.payment_method, s.status,
		 s.whatsapp_sent_customer, s.whatsapp_sent_admin, s.created_at, s.updated_at, s.receipts
		 FROM sales s
		 LEFT JOIN users u ON u.id = s.customer_id
		 WHERE (s.customer_id = $1 OR s.user_id = $1)
		 ORDER BY s.id DESC`, userID)
	if err != nil {
		jsonError(w, "error fetching your sales", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var sales []models.Sale
	for rows.Next() {
		var s models.Sale
		if err := rows.Scan(&s.ID, &s.CustomerID, &s.CustomerName, &s.CustomerEmail, &s.TotalAmount, &s.CustomerPhone, &s.CustomerIDNumber,
			&s.DeliveryAddress, &s.DeliveryCountry, &s.DeliveryDepartment, &s.DeliveryCity, &s.DeliveryAdditionalInfo,
			&s.PaymentMethod, &s.Status,
			&s.WhatsappSentCustomer, &s.WhatsappSentAdmin, &s.CreatedAt, &s.UpdatedAt, &s.Receipts); err != nil {
			continue
		}
		sales = append(sales, s)
	}
	if sales == nil {
		sales = []models.Sale{}
	}

	if len(sales) > 0 {
		saleIDs := make([]uuid.UUID, len(sales))
		for i, s := range sales {
			saleIDs[i] = s.ID
		}

		itemRows, err := db.Pool.Query(context.Background(),
			`SELECT id, sale_id, product_id, product_name, quantity, unit_price, subtotal 
			 FROM sale_items 
			 WHERE sale_id = ANY($1)
			 ORDER BY id`, saleIDs)
		if err == nil {
			defer itemRows.Close()
			itemsMap := make(map[uuid.UUID][]models.SaleItem)
			for itemRows.Next() {
				var item models.SaleItem
				if err := itemRows.Scan(&item.ID, &item.SaleID, &item.ProductID, &item.ProductName, &item.Quantity, &item.UnitPrice, &item.Subtotal); err == nil {
					itemsMap[item.SaleID] = append(itemsMap[item.SaleID], item)
				}
			}
			for i := range sales {
				if items, ok := itemsMap[sales[i].ID]; ok {
					sales[i].Items = items
				} else {
					sales[i].Items = []models.SaleItem{}
				}
			}
		}
	}

	jsonResponse(w, sales)
}

// GET /api/sales/:id
func GetSale(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	var s models.Sale
	err = db.Pool.QueryRow(context.Background(),
		`SELECT s.id, s.customer_id, COALESCE(s.customer_name, u.full_name), COALESCE(s.customer_email, u.email), s.total_amount, s.customer_phone, s.customer_id_number,
		 s.delivery_address, s.delivery_country, s.delivery_department, s.delivery_city, s.delivery_additional_info,
		 s.payment_method, s.status,
		 s.whatsapp_sent_customer, s.whatsapp_sent_admin, s.created_at, s.updated_at, s.receipts
		 FROM sales s
		 LEFT JOIN users u ON u.id = s.customer_id
		 WHERE s.id = $1`, id,
	).Scan(&s.ID, &s.CustomerID, &s.CustomerName, &s.CustomerEmail, &s.TotalAmount, &s.CustomerPhone, &s.CustomerIDNumber,
		&s.DeliveryAddress, &s.DeliveryCountry, &s.DeliveryDepartment, &s.DeliveryCity, &s.DeliveryAdditionalInfo,
		&s.PaymentMethod, &s.Status,
		&s.WhatsappSentCustomer, &s.WhatsappSentAdmin, &s.CreatedAt, &s.UpdatedAt, &s.Receipts)
	if err != nil {
		jsonError(w, "sale not found", http.StatusNotFound)
		return
	}

	// Fetch items with product names
	itemRows, err := db.Pool.Query(context.Background(),
		`SELECT id, sale_id, product_id, product_name, quantity, unit_price, subtotal 
		 FROM sale_items 
		 WHERE sale_id = $1
		 ORDER BY id`, id)
	if err == nil {
		defer itemRows.Close()
		for itemRows.Next() {
			var item models.SaleItem
			if err := itemRows.Scan(&item.ID, &item.SaleID, &item.ProductID, &item.ProductName, &item.Quantity, &item.UnitPrice, &item.Subtotal); err == nil {
				s.Items = append(s.Items, item)
			}
		}
	}
	if s.Items == nil {
		s.Items = []models.SaleItem{}
	}
	jsonResponse(w, s)
}

func CreateSale(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if r := recover(); r != nil {
			jsonError(w, "internal server error: panic recovered", http.StatusInternalServerError)
		}
	}()

	var req createSaleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.Items) == 0 {
		jsonError(w, "items are required", http.StatusBadRequest)
		return
	}

	// Extract CustomerID from authenticated context
	if ctxUserID := r.Context().Value(middleware.UserIDKey); ctxUserID != nil {
		id := ctxUserID.(uuid.UUID)
		req.CustomerID = &id
	}

	// Calculate total
	var total float64
	for _, item := range req.Items {
		total += float64(item.Quantity) * item.UnitPrice
	}

	// Start transaction
	tx, err := db.Pool.Begin(context.Background())
	if err != nil {
		jsonError(w, "error starting transaction", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(context.Background())

	if req.Receipts == nil {
		req.Receipts = []string{}
	}

	var saleID uuid.UUID
	err = tx.QueryRow(context.Background(),
		`INSERT INTO sales (customer_id, total_amount, customer_phone, customer_id_number, delivery_address, delivery_department, delivery_city, delivery_additional_info, payment_method, status, receipts)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
		req.CustomerID, total, req.CustomerPhone, req.CustomerIDNumber, req.DeliveryAddress, req.DeliveryDepartment, req.DeliveryCity, req.DeliveryAdditionalInfo, req.PaymentMethod, "PENDIENTE", req.Receipts,
	).Scan(&saleID)
	if err != nil {
		jsonError(w, "error creating sale: "+err.Error(), http.StatusInternalServerError)
		return
	}

	for _, item := range req.Items {
		subtotal := float64(item.Quantity) * item.UnitPrice

		// Lock the product row for update to prevent concurrent race conditions
		var dbProductName string
		var stock int
		var isDigital bool
		err = tx.QueryRow(context.Background(),
			`SELECT name, stock, is_digital FROM products WHERE id = $1 FOR UPDATE`, item.ProductID,
		).Scan(&dbProductName, &stock, &isDigital)

		if err != nil {
			jsonError(w, fmt.Sprintf("Producto no encontrado (ID: %s)", item.ProductID), http.StatusBadRequest)
			return
		}

		productName := item.ProductName
		if productName == "" {
			productName = dbProductName
		}

		// Strictly enforce stock limit for physical products in the backend
		if !isDigital && stock < item.Quantity {
			jsonError(w, fmt.Sprintf("Stock insuficiente para: %s. Requeridos: %d, Disponibles: %d", productName, item.Quantity, stock), http.StatusBadRequest)
			return
		}

		_, err = tx.Exec(context.Background(),
			`INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal) VALUES ($1,$2,$3,$4,$5,$6)`,
			saleID, item.ProductID, productName, item.Quantity, item.UnitPrice, subtotal)
		if err != nil {
			jsonError(w, "error creating sale item: "+err.Error(), http.StatusInternalServerError)
			return
		}

		if !isDigital {
			// Decrease stock for physical products
			_, err = tx.Exec(context.Background(),
				`UPDATE products SET stock = stock - $1 WHERE id = $2`, item.Quantity, item.ProductID)
			if err != nil {
				jsonError(w, "error updating stock: "+err.Error(), http.StatusInternalServerError)
				return
			}
		}
	}

	if err := tx.Commit(context.Background()); err != nil {
		jsonError(w, "error committing sale: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	jsonResponse(w, map[string]interface{}{"id": saleID, "total_amount": total, "message": "sale created"})
}

// PUT /api/sales/:id/status
func UpdateSaleStatus(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Si se está cancelando → devolver el stock de cada producto
	if req.Status == "CANCELADO" {
		tx, err := db.Pool.Begin(context.Background())
		if err != nil {
			jsonError(w, "error starting transaction", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(context.Background())

		// Leer los items del pedido
		rows, err := tx.Query(context.Background(),
			`SELECT product_id, quantity FROM sale_items WHERE sale_id = $1`, id)
		if err != nil {
			jsonError(w, "error fetching sale items", http.StatusInternalServerError)
			return
		}
		type item struct {
			productID uuid.UUID
			qty       int
		}
		var items []item
		for rows.Next() {
			var it item
			if err := rows.Scan(&it.productID, &it.qty); err == nil {
				items = append(items, it)
			}
		}
		rows.Close()

		// Restaurar stock sólo en productos físicos (no digitales)
		for _, it := range items {
			_, err = tx.Exec(context.Background(),
				`UPDATE products SET stock = stock + $1 WHERE id = $2 AND is_digital = false`,
				it.qty, it.productID)
			if err != nil {
				jsonError(w, "error restoring stock", http.StatusInternalServerError)
				return
			}
		}

		// Actualizar estado
		_, err = tx.Exec(context.Background(),
			`UPDATE sales SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
			req.Status, id)
		if err != nil {
			jsonError(w, "error updating sale status", http.StatusInternalServerError)
			return
		}

		if err := tx.Commit(context.Background()); err != nil {
			jsonError(w, "error committing transaction", http.StatusInternalServerError)
			return
		}

		jsonResponse(w, map[string]string{"message": "status updated, stock restored"})
		return
	}

	// Para cualquier otro cambio de estado, actualización directa
	_, err = db.Pool.Exec(context.Background(),
		`UPDATE sales SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
		req.Status, id)
	if err != nil {
		jsonError(w, "error updating sale status", http.StatusInternalServerError)
		return
	}

	jsonResponse(w, map[string]string{"message": "status updated"})
}
