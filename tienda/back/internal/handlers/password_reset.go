package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"time"

	"punto_de_venta_api/internal/db"

	"golang.org/x/crypto/bcrypt"
	gomail "gopkg.in/gomail.v2"
)

// ──────────────────────────────────────────────────────────────────────────────
// Request types
// ──────────────────────────────────────────────────────────────────────────────

type forgotPasswordRequest struct {
	Email string `json:"email"`
}

type resetPasswordRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
//
// Recibe un email, genera un token UUID temporal (15 min) en la BD y lo envía
// por correo con gomail.v2. Siempre responde 200 para no revelar si el email
// existe (seguridad por oscuridad).
// ──────────────────────────────────────────────────────────────────────────────

func ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req forgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" {
		jsonError(w, "se requiere un email válido", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	// 1. Eliminar tokens previos para este email (un solo token activo por cuenta)
	_, _ = db.Pool.Exec(ctx, `DELETE FROM password_resets WHERE email = $1`, req.Email)

	// 2. Insertar nuevo registro; gen_random_uuid() + DEFAULT interval generan token y expiración
	var token string
	var expiresAt time.Time
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO password_resets (email)
		 VALUES ($1)
		 RETURNING token::text, expires_at`,
		req.Email,
	).Scan(&token, &expiresAt)

	if err != nil {
		jsonError(w, "error al generar el token de recuperación", http.StatusInternalServerError)
		return
	}

	// 3. Enviar el correo en background para no bloquear la respuesta
	go sendResetEmail(req.Email, token)

	// 4. Respuesta genérica para no revelar si el email existe
	jsonResponse(w, map[string]string{
		"message": "Si el correo está registrado, recibirás un enlace de recuperación en breve.",
	})
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/auth/verify-reset-token?token=<uuid>
//
// Verifica que el token exista y no haya expirado. Permite al frontend validar
// antes de mostrar el formulario de nueva contraseña.
// ──────────────────────────────────────────────────────────────────────────────

func VerifyResetToken(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		jsonError(w, "token requerido", http.StatusBadRequest)
		return
	}

	var email string
	var expiresAt time.Time
	err := db.Pool.QueryRow(context.Background(),
		`SELECT email, expires_at
		 FROM password_resets
		 WHERE token = $1::uuid`,
		token,
	).Scan(&email, &expiresAt)

	if err != nil {
		jsonError(w, "token inválido o inexistente", http.StatusNotFound)
		return
	}

	if time.Now().After(expiresAt) {
		jsonError(w, "el token ha expirado", http.StatusGone)
		return
	}

	jsonResponse(w, map[string]interface{}{
		"valid":      true,
		"email":      email,
		"expires_at": expiresAt,
	})
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
//
// Valida el token, aplica bcrypt a la nueva contraseña, actualiza el registro
// en users (si existe un usuario local con ese email) y elimina el token.
// Diseño desacoplado: si no hay usuario local, el flujo no falla.
// ──────────────────────────────────────────────────────────────────────────────

func ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req resetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "cuerpo de solicitud inválido", http.StatusBadRequest)
		return
	}
	if req.Token == "" || req.Password == "" {
		jsonError(w, "token y password son requeridos", http.StatusBadRequest)
		return
	}
	if len(req.Password) < 8 {
		jsonError(w, "la contraseña debe tener al menos 8 caracteres", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	// 1. Validar token y obtener email asociado
	var email string
	var expiresAt time.Time
	err := db.Pool.QueryRow(ctx,
		`SELECT email, expires_at
		 FROM password_resets
		 WHERE token = $1::uuid`,
		req.Token,
	).Scan(&email, &expiresAt)

	if err != nil {
		jsonError(w, "token inválido o inexistente", http.StatusNotFound)
		return
	}

	if time.Now().After(expiresAt) {
		// Limpiar token expirado de forma silenciosa
		_, _ = db.Pool.Exec(ctx, `DELETE FROM password_resets WHERE token = $1::uuid`, req.Token)
		jsonError(w, "el token ha expirado, solicita uno nuevo", http.StatusGone)
		return
	}

	// 2. Generar hash bcrypt de la nueva contraseña
	hashBytes, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonError(w, "error al procesar la contraseña", http.StatusInternalServerError)
		return
	}
	newHash := string(hashBytes)

	// 3. Actualizar password_hash en users si existe un usuario local con ese email.
	//    Si no existe, el UPDATE no falla (0 filas afectadas está bien).
	_, _ = db.Pool.Exec(ctx,
		`UPDATE users
		 SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
		 WHERE email = $2`,
		newHash, email,
	)

	// 4. Invalidar el token (uso único)
	_, _ = db.Pool.Exec(ctx,
		`DELETE FROM password_resets WHERE token = $1::uuid`, req.Token)

	jsonResponse(w, map[string]string{
		"message": "Contraseña restablecida correctamente. Ya puedes iniciar sesión.",
	})
}

// ──────────────────────────────────────────────────────────────────────────────
// sendResetEmail — envía el correo de recuperación vía SMTP (gomail.v2)
// Se llama siempre en una goroutine para no bloquear el handler HTTP.
// ──────────────────────────────────────────────────────────────────────────────

func sendResetEmail(toEmail, token string) {
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:5173"
	}
	resetLink := frontendURL + "/reset-password?token=" + token

	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := 587
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASSWORD")
	smtpFrom := os.Getenv("SMTP_FROM")
	if smtpFrom == "" {
		smtpFrom = smtpUser
	}

	m := gomail.NewMessage()
	m.SetHeader("From", smtpFrom)
	m.SetHeader("To", toEmail)
	m.SetHeader("Subject", "🔑 Recuperación de contraseña - Vega")
	m.SetBody("text/html", buildResetEmailHTML(resetLink))

	d := gomail.NewDialer(smtpHost, smtpPort, smtpUser, smtpPass)

	// Silently skip email sending if SMTP not configured
	if smtpHost == "" || smtpUser == "" {
		return
	}

	// Send email silently (errors are ignored in production)
	_ = d.DialAndSend(m)
}

// buildResetEmailHTML — genera el cuerpo HTML responsive del correo.
func buildResetEmailHTML(resetLink string) string {
	year := time.Now().Format("2006")
	return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Recuperar contraseña</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:16px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);
                      padding:36px 40px;text-align:center;">
            <div style="font-size:40px;margin-bottom:10px;">🔑</div>
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;
                        letter-spacing:-0.5px;">Recuperar contraseña</h1>
            <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:13px;">
              Vega · Sistema de Punto de Venta
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">
              Recibimos una solicitud para restablecer la contraseña de tu cuenta.
              El enlace es válido durante <strong>15 minutos</strong>.
            </p>
            <div style="text-align:center;margin:28px 0;">
              <a href="` + resetLink + `"
                 style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);
                        color:#fff;text-decoration:none;font-size:15px;font-weight:700;
                        padding:14px 36px;border-radius:10px;
                        box-shadow:0 4px 14px rgba(99,102,241,0.4);">
                Restablecer contraseña
              </a>
            </div>
            <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:20px 0 0;">
              Si no solicitaste este cambio, ignora este correo. Tu contraseña no cambiará.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;text-align:center;
                      border-top:1px solid #e5e7eb;">
            <p style="color:#9ca3af;font-size:12px;margin:0;">
              © ` + year + ` Vega — Correo automático, no respondas a este mensaje.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
