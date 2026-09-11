package handlers

import (
	"fmt"
	"net/http"

	"punto_de_venta_api/internal/filestore"
)

// UploadReceipts maneja POST /api/upload_receipts
// Recibe hasta 2 imágenes de comprobantes de pago en el campo "receipts".
// Guarda los archivos en ./uploads/facturas/ y retorna las URLs públicas.
func UploadReceipts(w http.ResponseWriter, r *http.Request) {
	const maxSize = 10 << 20 // 10 MB por formulario
	if err := r.ParseMultipartForm(maxSize); err != nil {
		jsonError(w, "error al procesar el formulario", http.StatusBadRequest)
		return
	}

	const maxReceipts = 2
	files := r.MultipartForm.File["receipts"]
	if len(files) == 0 {
		jsonError(w, "no se enviaron archivos", http.StatusBadRequest)
		return
	}
	if len(files) > maxReceipts {
		jsonError(w, fmt.Sprintf("máximo %d comprobantes permitidos", maxReceipts), http.StatusBadRequest)
		return
	}

	var savedURLs []string
	for _, fileHeader := range files {
		file, err := fileHeader.Open()
		if err != nil {
			continue // saltar si no se puede abrir
		}

		// Guardar físicamente en ./uploads/facturas/ con nombre único
		publicURL, saveErr := filestore.SaveFile("facturas", file, fileHeader)
		file.Close() // cerrar inmediatamente para liberar el descriptor

		if saveErr != nil {
			// Si un archivo falla, continuar con el siguiente
			continue
		}
		savedURLs = append(savedURLs, publicURL)
	}

	if len(savedURLs) == 0 {
		jsonError(w, "no se pudo guardar ningún archivo", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	jsonResponse(w, map[string]interface{}{
		"message": "Comprobantes guardados exitosamente",
		"urls":    savedURLs,
	})
}
