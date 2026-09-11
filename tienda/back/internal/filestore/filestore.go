// Package filestore centraliza todas las operaciones de I/O de archivos multimedia.
// Es el único punto de contacto con el sistema de archivos del servidor, lo que
// garantiza que ningún registro de BD pueda quedar huérfano en disco.
package filestore

import (
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

// uploadsRoot es la raíz del volumen persistente mapeado en Docker.
// El docker-compose debe tener: volumes: - ./uploads:/app/uploads
const uploadsRoot = "./uploads"

// AllowedBuckets define los sub-directorios válidos dentro de uploadsRoot.
// Actúa como lista blanca para prevenir path traversal.
var AllowedBuckets = map[string]bool{
	"productos": true,
	"videos":    true,
	"facturas":  true,
}

// ErrBucketInvalid se devuelve cuando se solicita un bucket no registrado.
var ErrBucketInvalid = errors.New("bucket inválido")

// ErrFileNotFound se devuelve cuando el archivo no existe en disco.
// Se distingue del resto de errores para que el handler decida si responde 404 o 200.
var ErrFileNotFound = errors.New("archivo no encontrado en disco")

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN DE GUARDADO (UPLOAD)
// ─────────────────────────────────────────────────────────────────────────────

// SaveFile recibe un archivo multipart desde una petición HTTP, genera un nombre
// único mediante UUID + timestamp para evitar colisiones, y lo persiste en
// uploads/<bucket>/. Retorna la ruta pública relativa (ej. "/uploads/productos/abc.jpg")
// que debe guardarse como string en PostgreSQL.
//
// Parámetros:
//   - bucket: sub-carpeta destino ("productos", "videos", "facturas")
//   - file:   contenido del archivo proveniente de r.FormFile(...)
//   - header: cabecera del archivo, usada para extraer la extensión original
//
// Retorna (publicURL, error). publicURL es la ruta relativa que sirve el servidor.
func SaveFile(bucket string, file multipart.File, header *multipart.FileHeader) (publicURL string, err error) {
	// 1. Validar que el bucket sea de la lista blanca
	if !AllowedBuckets[bucket] {
		return "", ErrBucketInvalid
	}

	// 2. Asegurar que la carpeta de destino exista en el volumen Docker.
	//    os.MkdirAll es idempotente: no falla si ya existe.
	destDir := filepath.Join(uploadsRoot, bucket)
	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return "", fmt.Errorf("no se pudo crear el directorio de destino %q: %w", destDir, err)
	}

	// 3. Generar nombre único: <unix_nano>_<uuid>.<ext_original>
	//    - Unix nano: evita colisiones en subida simultánea
	//    - UUID:      hace el nombre impredecible (seguridad)
	//    - Ext:       preserva el tipo MIME para que el navegador pueda servirlo
	ext := sanitizeExt(filepath.Ext(header.Filename))
	uniqueName := fmt.Sprintf("%d_%s%s", time.Now().UnixNano(), uuid.New().String(), ext)
	absPath := filepath.Join(destDir, uniqueName)

	// 4. Crear el archivo vacío en disco. Si falla aquí, nada queda escrito.
	out, err := os.Create(absPath)
	if err != nil {
		return "", fmt.Errorf("no se pudo crear el archivo en disco %q: %w", absPath, err)
	}
	defer out.Close()

	// 5. Copiar el stream del multipart al archivo en disco.
	//    io.Copy usa un buffer interno de 32 KB, eficiente para archivos grandes.
	if _, err := io.Copy(out, file); err != nil {
		// Intentar limpiar el archivo parcialmente escrito para no dejar basura
		_ = os.Remove(absPath)
		return "", fmt.Errorf("error al escribir el archivo en disco: %w", err)
	}

	// 6. Detectar tipo MIME real leyendo los primeros 512 bytes (protección extra)
	//    — opcional pero recomendado en producción para rechazar ejecutables disfrazados
	//    de imágenes. Omitido aquí para mantener el foco en la lógica de I/O.

	// Retornar ruta pública relativa (sin el punto inicial)
	publicURL = "/" + filepath.ToSlash(filepath.Join(uploadsRoot[2:], bucket, uniqueName))
	return publicURL, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN DE ELIMINACIÓN FÍSICA (DELETE)
// ─────────────────────────────────────────────────────────────────────────────

// RemoveFile borra físicamente el archivo del volumen Docker usando os.Remove.
//
// Cómo funciona os.Remove en el contexto de Docker + SSD:
//   - os.Remove llama a la syscall `unlink` del SO (en Linux, que es lo que corre
//     dentro del contenedor Docker). `unlink` elimina la entrada del directorio y
//     decrementa el contador de hard-links del inodo.
//   - Cuando el contador llega a 0 y ningún proceso tiene el archivo abierto,
//     el SO marca los bloques como disponibles en el SSD.
//   - Dado que el directorio ./uploads está mapeado a un bind mount del SSD del
//     servidor, la liberación de espacio ocurre INMEDIATAMENTE en el disco físico,
//     no al reiniciar el contenedor.
//   - Esto garantiza que no queden "archivos fantasma" acumulando espacio en el
//     volumen de 256 GB.
//
// Parámetros:
//   - publicURL: la ruta pública tal como está guardada en PostgreSQL
//     (ej. "/uploads/productos/1234_uuid.jpg")
//
// Errores:
//   - ErrFileNotFound si el archivo no existe (el caller decide si esto es un error fatal)
//   - Cualquier otro error de sistema de archivos
func RemoveFile(publicURL string) error {
	if publicURL == "" {
		return nil // nada que borrar
	}

	// Convertir URL pública → ruta del sistema de archivos local
	// "/uploads/productos/file.jpg" → "./uploads/productos/file.jpg"
	localPath, err := publicURLToLocalPath(publicURL)
	if err != nil {
		return err
	}

	// os.Remove hace el unlink atómico en el sistema de archivos del contenedor.
	// El kernel de Linux libera el inodo y sus bloques en el SSD una vez que
	// no haya ningún file descriptor abierto apuntando al inodo.
	if err := os.Remove(localPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			// El archivo ya no existe en disco. Registrar como advertencia pero
			// NO tratar como error fatal: el registro de BD aún debe borrarse.
			log.Printf("[filestore] WARN: archivo no encontrado en disco, se ignora: %s", localPath)
			return ErrFileNotFound
		}
		// Error real de permisos u otro problema del SO
		log.Printf("[filestore] ERROR: no se pudo eliminar %s: %v", localPath, err)
		return fmt.Errorf("no se pudo eliminar el archivo %q del disco: %w", localPath, err)
	}

	log.Printf("[filestore] INFO: archivo eliminado del SSD: %s", localPath)
	return nil
}

// RemoveFileIgnoreNotFound es un wrapper conveniente para los handlers que
// quieren continuar incluso si el archivo ya no estaba en disco.
// Registra la advertencia pero no devuelve error en ese caso.
func RemoveFileIgnoreNotFound(publicURL string) error {
	err := RemoveFile(publicURL)
	if errors.Is(err, ErrFileNotFound) {
		return nil // no es un error crítico para el flujo de negocio
	}
	return err
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

// publicURLToLocalPath convierte la URL pública "/uploads/bucket/file.ext"
// a la ruta local "./uploads/bucket/file.ext" con validaciones de seguridad.
func publicURLToLocalPath(publicURL string) (string, error) {
	// Normalizar: quitar el slash inicial
	rel := strings.TrimPrefix(publicURL, "/")

	// Verificar que comience con "uploads/" (nuestra raíz)
	if !strings.HasPrefix(rel, "uploads/") {
		return "", fmt.Errorf("URL pública no pertenece a uploads/: %q", publicURL)
	}

	// Prevenir path traversal (ej. "uploads/../etc/passwd")
	clean := filepath.Clean(rel)
	if strings.Contains(clean, "..") {
		return "", fmt.Errorf("ruta inválida detectada (path traversal): %q", publicURL)
	}

	// Extraer el bucket del segundo segmento de la ruta
	parts := strings.SplitN(clean, string(os.PathSeparator), 3)
	if len(parts) < 3 {
		return "", fmt.Errorf("ruta de uploads mal formada: %q", publicURL)
	}
	bucket := parts[1]
	if !AllowedBuckets[bucket] {
		return "", fmt.Errorf("bucket no permitido %q en URL: %s", bucket, publicURL)
	}

	localPath := "." + string(os.PathSeparator) + clean
	return localPath, nil
}

// sanitizeExt asegura que la extensión sea segura y en minúsculas.
// Si es vacía o desconocida, retorna ".bin" como fallback neutro.
func sanitizeExt(ext string) string {
	allowed := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true, ".gif": true,
		".webp": true, ".avif": true, ".jfif": true,
		".mp4": true, ".webm": true, ".mov": true,
		".pdf": true,
	}
	lower := strings.ToLower(ext)
	if allowed[lower] {
		return lower
	}
	return ".bin"
}

// DetectMediaType devuelve "image", "video" o "file" basado en la extensión.
// Útil para poblar la columna media_type en product_media.
func DetectMediaType(filename string) string {
	lower := strings.ToLower(filename)
	switch {
	case strings.HasSuffix(lower, ".mp4"),
		strings.HasSuffix(lower, ".webm"),
		strings.HasSuffix(lower, ".mov"):
		return "video"
	case strings.HasSuffix(lower, ".jpg"),
		strings.HasSuffix(lower, ".jpeg"),
		strings.HasSuffix(lower, ".png"),
		strings.HasSuffix(lower, ".gif"),
		strings.HasSuffix(lower, ".webp"),
		strings.HasSuffix(lower, ".avif"),
		strings.HasSuffix(lower, ".jfif"):
		return "image"
	default:
		return "file"
	}
}

// SanitizeFilename retorna solo el basename sin componentes de directorio.
// Previene ataques de path traversal en nombres de archivo enviados por el cliente.
func SanitizeFilename(name string) (string, error) {
	base := filepath.Base(filepath.Clean(name))
	if base == "." || base == ".." || strings.ContainsAny(base, "/\\") {
		return "", fmt.Errorf("nombre de archivo inválido: %q", name)
	}
	return base, nil
}

// ValidateImageContentType lee los primeros 512 bytes de un archivo multipart
// y verifica que el Content-Type sea de imagen o video.
// Retorna el MIME type detectado y un error si no es permitido.
func ValidateImageContentType(file multipart.File) (string, error) {
	buf := make([]byte, 512)
	n, err := file.Read(buf)
	if err != nil && !errors.Is(err, io.EOF) {
		return "", fmt.Errorf("no se pudo leer el archivo para validación: %w", err)
	}

	mime := http.DetectContentType(buf[:n])

	// Restablecer el reader al inicio para que el caller pueda copiar todo el archivo
	if seeker, ok := file.(io.Seeker); ok {
		if _, err := seeker.Seek(0, io.SeekStart); err != nil {
			return "", fmt.Errorf("no se pudo resetear el cursor del archivo: %w", err)
		}
	}

	allowed := map[string]bool{
		"image/jpeg": true, "image/png": true, "image/gif": true,
		"image/webp": true, "image/avif": true,
		"video/mp4": true, "video/webm": true, "video/quicktime": true,
		"application/pdf": true,
	}
	if !allowed[mime] {
		return mime, fmt.Errorf("tipo de archivo no permitido: %s", mime)
	}
	return mime, nil
}
