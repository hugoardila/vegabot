package router

import (
	"net/http"
	"path/filepath"

	"os"
	"time"

	"punto_de_venta_api/internal/handlers"
	"punto_de_venta_api/internal/middleware"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/httprate"
)

func New() http.Handler {
	r := chi.NewRouter()

	// Middlewares globales
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.RealIP)

	// CORS Hardening
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			allowedOrigin := os.Getenv("FRONTEND_URL")
			if allowedOrigin == "" {
				allowedOrigin = "http://localhost:5173" // Cambiado de 5174 a 5173
			}
			w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			if req.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, req)
		})
	})

	// Security Headers (Helmet)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("X-XSS-Protection", "1; mode=block")
			w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
			// Remove X-Powered-By
			w.Header().Del("X-Powered-By")
			next.ServeHTTP(w, req)
		})
	})

	// Root handler - generic response (no sensitive info)
	r.Get("/", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome</title>
</html>`))
	})

	uploadsDir := filepath.Join(".", "uploads", "productos")
	facturasDir := filepath.Join(".", "uploads", "facturas")
	videosDir := filepath.Join(".", "uploads", "videos")
	os.MkdirAll(uploadsDir, os.ModePerm)
	os.MkdirAll(facturasDir, os.ModePerm)
	os.MkdirAll(videosDir, os.ModePerm)

	r.Handle("/uploads/productos/*", http.StripPrefix("/uploads/productos/", http.FileServer(http.Dir(uploadsDir))))
	r.Handle("/uploads/facturas/*", http.StripPrefix("/uploads/facturas/", http.FileServer(http.Dir(facturasDir))))
	r.Handle("/uploads/videos/*", http.StripPrefix("/uploads/videos/", http.FileServer(http.Dir(videosDir))))

	r.Route("/api", func(r chi.Router) {

		// ── Auth (públicas) con anti Fuerza Bruta ──────────────────────
		r.Route("/auth", func(r chi.Router) {
			// Limitador de 10 peticiones por minuto por IP
			r.Use(httprate.LimitByIP(10, 1*time.Minute))
			r.Post("/register", handlers.Register)
			r.Post("/login", handlers.Login)
			r.Post("/google", handlers.GoogleLogin)
			// ── Password Reset ──────────────────────────────────────────
			r.Post("/forgot-password", handlers.ForgotPassword)
			r.Get("/verify-reset-token", handlers.VerifyResetToken)
			r.Post("/reset-password", handlers.ResetPassword)
		})

		// ── Categories ─────────────────────────────────────────────────
		r.Get("/categories", handlers.GetCategories)
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth, middleware.AdminOnly)
			r.Post("/categories", handlers.CreateCategory)
			r.Put("/categories/{id}", handlers.UpdateCategory)
			r.Delete("/categories/{id}", handlers.DeleteCategory)
		})

		// ── Suppliers ──────────────────────────────────────────────────
		r.Get("/suppliers", handlers.GetSuppliers)
		r.Get("/suppliers/{id}", handlers.GetSupplierByID)
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth, middleware.AdminOnly)
			r.Post("/suppliers", handlers.CreateSupplier)
			r.Put("/suppliers/{id}", handlers.UpdateSupplier)
			r.Delete("/suppliers/{id}", handlers.DeleteSupplier)
		})

		// ── Products ───────────────────────────────────────────────────
		r.Get("/products", handlers.GetProducts)
		r.Get("/products/{id}", handlers.GetProduct)
		r.Get("/products/{id}/media", handlers.GetProductMedia)
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth, middleware.AdminOnly)
			r.Post("/products", handlers.CreateProduct)
			r.Put("/products/{id}", handlers.UpdateProduct)
			r.Delete("/products/{id}", handlers.DeleteProduct)
			r.Post("/products/{id}/media", handlers.AddProductMedia)
			r.Delete("/media/{id}", handlers.DeleteProductMedia)
			r.Get("/products/{id}/licenses", handlers.GetLicenses)
			r.Post("/products/{id}/licenses", handlers.AddLicense)
		})

		r.Get("/products/{id}/reviews", handlers.GetProductReviews)
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth)
			r.Post("/products/{id}/reviews", handlers.CreateProductReview)
			r.Delete("/reviews/{id}", handlers.DeleteProductReview)
		})

		// ── Sales ──────────────────────────────────────────────────────
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth)
			r.Post("/sales", handlers.CreateSale)
			r.Get("/sales/me", handlers.GetMySales)
			r.Get("/sales/{id}", handlers.GetSale)
			r.Post("/pedidos/{id}/pagar", handlers.PayExistingSale)
			r.Post("/upload_receipts", handlers.UploadReceipts)
		})

		// ── Uploads ────────────────────────────────────────────────────
		// Público (clientes) - listar videos
		r.Get("/uploads/videos", handlers.ListUploads)
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth, middleware.AdminOnly)
			r.Post("/upload", handlers.UploadFile)
			r.Post("/upload_video", handlers.UploadVideo)
			r.Put("/settings", handlers.UpdateSettings)
			r.Get("/uploads/productos", handlers.ListUploads)
			r.Get("/uploads/facturas", handlers.ListUploads)
			r.Delete("/uploads/{bucket}/*", handlers.DeleteUpload)
		})

		r.Get("/settings", handlers.GetSettings)

		// ── Users ──────────────────────────────────────────────────────
		r.Route("/users", func(r chi.Router) {
			// Perfil propio (cualquier usuario autenticado)
			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth)
				r.Put("/profile", handlers.UpdateProfile)
			})

			// Gestión de usuarios (admin y super_admin)
			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth, middleware.AdminOnly)
				r.Get("/", handlers.GetUsers)
				r.Get("/{id}", handlers.GetUser)
				r.Put("/{id}", handlers.UpdateUser)
				r.Delete("/{id}", handlers.DeleteUser)
			})

			// Crear admins (solo super_admin)
			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth, middleware.SuperAdminOnly)
				r.Post("/create-admin", handlers.CreateAdmin)
			})
		})

		// ── Sales Management (admin) ──────────────────────────────────
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth, middleware.AdminOnly)
			r.Get("/sales", handlers.GetSales)
			r.Get("/sales/months", handlers.GetSalesMonths)
			r.Put("/sales/{id}/status", handlers.UpdateSaleStatus)
		})

		// ── Wompi Payment Gateway ──────────────────────────────────────
		// Endpoints públicos (sin autenticación)
		r.Get("/wompi/verify-transaction/{id}", handlers.VerifyWompiTransaction)
		r.Post("/wompi/webhook", handlers.WompiWebhook)
		r.Post("/wompi/test-payment-link", handlers.TestWompiPaymentLink)

		// Endpoints protegidos (requieren autenticación)
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth)
			// Método Widget (original)
			r.Post("/wompi/create-transaction", handlers.CreateWompiTransaction)
			// Método Payment Link (recomendado - más simple)
			r.Post("/wompi/create-payment-link", handlers.CreateWompiPaymentLink)
			// Método API Directa (requiere payment_method)
			r.Post("/wompi/create-transaction-direct", handlers.CreateWompiTransactionDirect)

			// ── Nuevos endpoints con sistema de colas ──────────────────
			// Método Payment Link con Cola (RECOMENDADO - más robusto)
			r.Post("/wompi/create-payment-link-queue", handlers.CreateWompiPaymentLinkWithQueue)
			// Obtener estado de una venta
			r.Get("/sales/{id}/status", handlers.GetSaleStatus)
		})

	})

	return r
}
