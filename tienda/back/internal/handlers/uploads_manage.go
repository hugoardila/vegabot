package handlers

import (
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"punto_de_venta_api/internal/filestore"
)

type uploadBucket string

const (
	bucketProductos uploadBucket = "productos"
	bucketFacturas  uploadBucket = "facturas"
	bucketVideos    uploadBucket = "videos"
)

func bucketDir(bucket uploadBucket) (string, bool) {
	switch bucket {
	case bucketProductos:
		return "./uploads/productos", true
	case bucketFacturas:
		return "./uploads/facturas", true
	case bucketVideos:
		return "./uploads/videos", true
	default:
		return "", false
	}
}

func detectUploadType(lowerName string) string {
	switch {
	case hasSuffixAny(lowerName, []string{".mp4", ".webm", ".mov"}):
		return "video"
	case hasSuffixAny(lowerName, []string{".pdf"}):
		return "pdf"
	case hasSuffixAny(lowerName, []string{".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".jfif"}):
		return "image"
	default:
		return "file"
	}
}

// ListUploads handles GET /api/uploads/{bucket}
func ListUploads(w http.ResponseWriter, r *http.Request) {
	b := uploadBucket(strings.ToLower(strings.TrimSpace(filepath.Base(r.URL.Path))))
	// Note: router uses explicit routes (/uploads/productos, /uploads/facturas, /uploads/videos),
	// so we infer bucket from the last segment safely via filepath.Base on the URL path.

	uploadDir, ok := bucketDir(b)
	if !ok {
		jsonError(w, "Bucket inválido", http.StatusBadRequest)
		return
	}

	entries, err := os.ReadDir(uploadDir)
	if err != nil {
		jsonError(w, "No se pudo leer la carpeta", http.StatusInternalServerError)
		return
	}

	var files []map[string]interface{}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		filename := entry.Name()
		lowerName := strings.ToLower(filename)
		t := detectUploadType(lowerName)

		files = append(files, map[string]interface{}{
			"name":     filename,
			"url":      "/uploads/" + string(b) + "/" + filename,
			"type":     t,
			"size":     info.Size(),
			"modified": info.ModTime().Unix(),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	jsonResponse(w, map[string]interface{}{
		"bucket": string(b),
		"files":  files,
		"count":  len(files),
	})
}

// DeleteUpload handles DELETE /api/uploads/{bucket}/{filename}
func DeleteUpload(w http.ResponseWriter, r *http.Request) {
	// Expected path: /api/uploads/{bucket}/{filename}
	// We'll parse bucket and filename from URL path without relying on router params,
	// to keep this handler simple and avoid additional imports.
	path := strings.TrimPrefix(r.URL.Path, "/api/uploads/")
	parts := strings.SplitN(path, "/", 2)
	if len(parts) != 2 {
		jsonError(w, "Ruta inválida", http.StatusBadRequest)
		return
	}

	b := uploadBucket(strings.ToLower(strings.TrimSpace(parts[0])))
	_, ok := bucketDir(b) // validar que el bucket exista en la lista blanca
	if !ok {
		jsonError(w, "Bucket inválido", http.StatusBadRequest)
		return
	}

	rawName, err := url.PathUnescape(parts[1])
	if err != nil {
		jsonError(w, "Nombre de archivo inválido", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(rawName)
	if name == "" {
		jsonError(w, "Nombre de archivo requerido", http.StatusBadRequest)
		return
	}
	if strings.ContainsAny(name, "/\\") || strings.Contains(name, "..") {
		jsonError(w, "Nombre de archivo inválido", http.StatusBadRequest)
		return
	}
	if filepath.Base(name) != name {
		jsonError(w, "Nombre de archivo inválido", http.StatusBadRequest)
		return
	}

	// Usar filestore.RemoveFile para eliminar el archivo físico del SSD.
	// Internamente llama a os.Remove → syscall unlink en el contenedor Docker.
	// La ruta local es calculada internamente por filestore.publicURLToLocalPath.
	publicURL := "/uploads/" + string(b) + "/" + name
	if err := filestore.RemoveFile(publicURL); err != nil {
		if err == filestore.ErrFileNotFound {
			jsonError(w, "Archivo no encontrado en disco", http.StatusNotFound)
			return
		}
		jsonError(w, "No se pudo eliminar el archivo del disco", http.StatusInternalServerError)
		return
	}

	jsonResponse(w, map[string]interface{}{
		"ok":     true,
		"bucket": string(b),
		"name":   name,
	})
}

