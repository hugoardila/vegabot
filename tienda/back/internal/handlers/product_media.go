package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"punto_de_venta_api/internal/db"
	"punto_de_venta_api/internal/filestore"
	"punto_de_venta_api/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// GetProductMedia maneja GET /api/products/:id/media
func GetProductMedia(w http.ResponseWriter, r *http.Request) {
	productID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		jsonError(w, "id de producto inválido", http.StatusBadRequest)
		return
	}

	rows, err := db.Pool.Query(context.Background(),
		`SELECT id, product_id, url, media_type, is_main, created_at
		 FROM product_media
		 WHERE product_id = $1
		 ORDER BY is_main DESC, id`,
		productID)
	if err != nil {
		jsonError(w, "error al obtener el media del producto", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var media []models.ProductMedia
	for rows.Next() {
		var m models.ProductMedia
		if err := rows.Scan(&m.ID, &m.ProductID, &m.URL, &m.MediaType, &m.IsMain, &m.CreatedAt); err != nil {
			continue
		}
		media = append(media, m)
	}
	if media == nil {
		media = []models.ProductMedia{}
	}
	jsonResponse(w, media)
}

// AddProductMedia maneja POST /api/products/:id/media
// Asocia una URL de media (ya subida vía /api/upload) al producto.
func AddProductMedia(w http.ResponseWriter, r *http.Request) {
	productID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		jsonError(w, "id de producto inválido", http.StatusBadRequest)
		return
	}

	var body struct {
		URL       string  `json:"url"`
		MediaType *string `json:"media_type"`
		IsMain    bool    `json:"is_main"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.URL == "" {
		jsonError(w, "url es requerida", http.StatusBadRequest)
		return
	}

	var m models.ProductMedia
	err = db.Pool.QueryRow(context.Background(),
		`INSERT INTO product_media (product_id, url, media_type, is_main)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, product_id, url, media_type, is_main, created_at`,
		productID, body.URL, body.MediaType, body.IsMain,
	).Scan(&m.ID, &m.ProductID, &m.URL, &m.MediaType, &m.IsMain, &m.CreatedAt)
	if err != nil {
		jsonError(w, "error al agregar media al producto", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	jsonResponse(w, m)
}

// DeleteProductMedia maneja DELETE /api/media/:id
//
// Orden de operaciones (CRÍTICO para el SSD de 256 GB):
//
//  1. Consultar la URL del archivo en PostgreSQL.
//  2. Eliminar el REGISTRO de la base de datos.
//  3. Eliminar el ARCHIVO FÍSICO del disco (os.Remove → syscall unlink en Linux).
//
// La eliminación del archivo ocurre DESPUÉS del DELETE de BD porque:
//   - Si el archivo falla, el registro ya está borrado → el frontend no verá más el archivo.
//   - Si el archivo existe pero falla el DELETE de BD, el registro queda huérfano y el archivo
//     permanece en disco (que es el caso inverso indeseable).
//
// El orden DB-primero es el patrón más seguro cuando no se usa 2-phase commit.
func DeleteProductMedia(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		jsonError(w, "id inválido", http.StatusBadRequest)
		return
	}

	// PASO 1: Obtener la URL del archivo antes de eliminarlo.
	// Si el registro no existe, la URL queda vacía y se maneja más abajo.
	var fileURL string
	_ = db.Pool.QueryRow(context.Background(),
		`SELECT url FROM product_media WHERE id = $1`, id,
	).Scan(&fileURL)

	// PASO 2: Eliminar el registro de PostgreSQL.
	// Usamos RETURNING para confirmar que realmente existía el registro.
	tag, err := db.Pool.Exec(context.Background(),
		`DELETE FROM product_media WHERE id = $1`, id)
	if err != nil {
		jsonError(w, "error al eliminar el registro de media", http.StatusInternalServerError)
		return
	}
	if tag.RowsAffected() == 0 {
		jsonError(w, "registro de media no encontrado", http.StatusNotFound)
		return
	}

	// PASO 3: Eliminar el archivo físico del SSD.
	//
	// filestore.RemoveFile llama internamente a os.Remove(localPath), que ejecuta
	// la syscall `unlink` en el sistema de archivos del contenedor Docker.
	// Como ./uploads está mapeado como bind mount al SSD del servidor:
	//   → El SO decrementa el contador de hard-links del inodo.
	//   → Cuando llega a 0 (y no hay file descriptors abiertos), libera los bloques.
	//   → El espacio queda disponible INMEDIATAMENTE en el SSD físico.
	//
	// Si el archivo ya no existía en disco (ErrFileNotFound), lo ignoramos con una
	// advertencia en el log. El registro de BD ya fue borrado, que es lo importante.
	if fileURL != "" {
		if err := filestore.RemoveFileIgnoreNotFound(fileURL); err != nil {
			// Error real (ej. permisos). Loggear pero responder 200:
			// el registro de BD ya está borrado, el frontend no verá más el archivo.
			log.Printf("[DeleteProductMedia] ERROR al eliminar archivo físico ID=%s URL=%s: %v", id, fileURL, err)
		}
	}

	jsonResponse(w, map[string]interface{}{
		"ok":      true,
		"message": "media eliminado correctamente",
		"id":      id,
	})
}
