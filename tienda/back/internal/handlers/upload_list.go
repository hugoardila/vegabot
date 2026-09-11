package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
)

// ListUploadProductos handles GET /api/uploads/productos
// Lists all files in the uploads/productos folder
func ListUploadProductos(w http.ResponseWriter, r *http.Request) {
	uploadDir := "./uploads/productos"

	// Read directory contents
	entries, err := os.ReadDir(uploadDir)
	if err != nil {
		jsonError(w, "Unable to read upload directory", http.StatusInternalServerError)
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

		// Only include image and video files (HasSuffix covers names like "*.jp.avif")
		isImage := hasSuffixAny(lowerName, []string{".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".jfif"})
		isVideo := hasSuffixAny(lowerName, []string{".mp4", ".webm", ".mov"})

		if isImage || isVideo {
			files = append(files, map[string]interface{}{
				"name":     filename,
				"url":      "/uploads/productos/" + filename,
				"type":     func() string { if isVideo { return "video" } else { return "image" } }(),
				"size":     info.Size(),
				"modified": info.ModTime().Unix(),
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"files": files,
		"count": len(files),
	})
}

func hasSuffixAny(s string, suffixes []string) bool {
	for _, suf := range suffixes {
		if strings.HasSuffix(s, suf) {
			return true
		}
	}
	return false
}
