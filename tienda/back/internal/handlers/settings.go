package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"punto_de_venta_api/internal/db"
)

func ensureSettingsTableExists(ctx context.Context) error {
	_, err := db.Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS store_settings (
			setting_key VARCHAR(100) PRIMARY KEY,
			setting_value TEXT NOT NULL
		)
	`)
	if err != nil {
		return err
	}
	
	// Insertar configuraciones por defecto
	settings := []struct {
		key   string
		value string
	}{
		{"hero_banner_url", ""},
		{"escena_1_url", ""},
		{"escena_2_url", ""},
	}
	
	for _, s := range settings {
		_, err = db.Pool.Exec(ctx, `
			INSERT INTO store_settings (setting_key, setting_value)
			VALUES ($1, $2)
			ON CONFLICT (setting_key) DO NOTHING
		`, s.key, s.value)
		if err != nil {
			return err
		}
	}
	
	return nil
}

// GET /api/settings
func GetSettings(w http.ResponseWriter, r *http.Request) {
	settings := make(map[string]string)

	err := ensureSettingsTableExists(context.Background())
	if err != nil {
		fmt.Printf("ERROR in GetSettings (ensure table): %v\n", err)
		jsonResponse(w, settings)
		return
	}

	rows, err := db.Pool.Query(context.Background(), "SELECT setting_key, setting_value FROM store_settings")
	if err != nil {
		fmt.Printf("ERROR in GetSettings (Query): %v\n", err)
		jsonResponse(w, settings)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var key, val string
		if err := rows.Scan(&key, &val); err != nil {
			fmt.Printf("ERROR in GetSettings (Scan): %v\n", err)
			continue
		}
		settings[key] = val
	}
	if err := rows.Err(); err != nil {
		fmt.Printf("ERROR in GetSettings (rows.Err): %v\n", err)
	}
	jsonResponse(w, settings)
}

// PUT /api/settings
func UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var body map[string]string
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	err := ensureSettingsTableExists(context.Background())
	if err != nil {
		fmt.Printf("ERROR in UpdateSettings (ensure table): %v\n", err)
		jsonError(w, "error preparing settings table", http.StatusInternalServerError)
		return
	}

	for key, val := range body {
		_, err := db.Pool.Exec(context.Background(),
			`INSERT INTO store_settings (setting_key, setting_value) VALUES ($1, $2)
			 ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
			key, val,
		)
		if err != nil {
			jsonError(w, "error updating setting: "+key, http.StatusInternalServerError)
			return
		}
	}

	jsonResponse(w, map[string]string{"message": "settings updated"})
}
