package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"punto_de_venta_api/internal/filestore"
)

// UploadFile maneja POST /api/upload
// Recibe un archivo de imagen en el campo "image" del form multipart.
// Guarda el archivo en ./uploads/productos/ con nombre único y retorna la URL pública.
func UploadFile(w http.ResponseWriter, r *http.Request) {
	// Límite de 200 MB para soportar imágenes de alta resolución
	const maxSize = 200 << 20
	if err := r.ParseMultipartForm(maxSize); err != nil {
		jsonError(w, "error al procesar el formulario", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		jsonError(w, "campo 'image' requerido", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Validar Content-Type real (evita ejecutables disfrazados de imágenes)
	if _, err := filestore.ValidateImageContentType(file); err != nil {
		jsonError(w, "tipo de archivo no permitido: "+err.Error(), http.StatusUnsupportedMediaType)
		return
	}

	// Guardar físicamente en ./uploads/productos/<timestamp_uuid.ext>
	// SaveFile retorna la URL pública relativa lista para guardar en PostgreSQL
	publicURL, err := filestore.SaveFile("productos", file, header)
	if err != nil {
		jsonError(w, "error al guardar el archivo: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"url": publicURL})
}

// UploadVideo maneja POST /api/upload_video
// Recibe un video en el campo "video" del form multipart.
// Guarda el archivo en ./uploads/videos/ con nombre único y retorna la URL pública.
func UploadVideo(w http.ResponseWriter, r *http.Request) {
	const maxVideoSize = 500 << 20 // 500 MB
	r.Body = http.MaxBytesReader(w, r.Body, maxVideoSize)

	if err := r.ParseMultipartForm(maxVideoSize); err != nil {
		msg := "error al procesar el formulario"
		if strings.Contains(err.Error(), "request body too large") {
			msg = "video demasiado grande. El límite es 500 MB"
		}
		jsonError(w, msg, http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("video")
	if err != nil {
		jsonError(w, "campo 'video' requerido", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Guardar en ./uploads/videos/
	publicURL, err := filestore.SaveFile("videos", file, header)
	if err != nil {
		jsonError(w, "error al guardar el video: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"url": publicURL})
}
