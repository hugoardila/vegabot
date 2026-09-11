import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { motion } from "framer-motion";
import { authService } from "../services/auth";

type Stage =
  | "verifying"   // validando el token al montar
  | "invalid"     // token inválido o expirado
  | "form"        // mostrar formulario de nueva contraseña
  | "success";    // contraseña restablecida

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";

  const [stage, setStage] = useState<Stage>("verifying");
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // ── 1. Verificar token al montar ──────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setErrorMsg("No se encontró un token en la URL.");
      setStage("invalid");
      return;
    }

    authService
      .verifyResetToken(token)
      .then((data) => {
        setEmail(data.email);
        setStage("form");
      })
      .catch((err: Error) => {
        setErrorMsg(err.message || "El enlace es inválido o ha expirado.");
        setStage("invalid");
      });
  }, [token]);

  // ── 2. Enviar nueva contraseña ────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (password.length < 8) {
      setFormError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setFormError("Las contraseñas no coinciden.");
      return;
    }

    setIsLoading(true);
    try {
      await authService.resetPassword(token, password);
      setStage("success");
    } catch (err: any) {
      setFormError(err.message || "Ocurrió un error. Intenta solicitar un nuevo enlace.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Helpers de UI ─────────────────────────────────────────────────────────
  const strengthColor = () => {
    if (password.length === 0) return "bg-black/10 dark:bg-white/10";
    if (password.length < 8)  return "bg-danger";
    if (password.length < 12) return "bg-warning";
    return "bg-success";
  };
  const strengthWidth = () => {
    if (password.length === 0) return "0%";
    const pct = Math.min((password.length / 20) * 100, 100);
    return `${pct}%`;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f8f9fa] dark:bg-[#0a0a0a] p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <Card className="border-none shadow-2xl bg-white/80 dark:bg-white/5 backdrop-blur-xl">
          <CardHeader className="flex flex-col gap-1 items-center pt-8 pb-4">
            {/* Icono dinámico según stage */}
            <div
              className={`size-14 rounded-2xl flex items-center justify-center text-3xl mb-3 shadow-lg
                ${stage === "success"
                  ? "bg-success shadow-success/20"
                  : stage === "invalid"
                  ? "bg-danger shadow-danger/20"
                  : "bg-primary shadow-primary/20"}`}
            >
              {stage === "verifying" && "⏳"}
              {stage === "invalid"   && "🔒"}
              {stage === "form"      && "🔑"}
              {stage === "success"   && "✅"}
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">
              {stage === "verifying" && "Verificando enlace…"}
              {stage === "invalid"   && "Enlace inválido"}
              {stage === "form"      && "Nueva contraseña"}
              {stage === "success"   && "¡Listo!"}
            </h1>

            {email && stage === "form" && (
              <p className="text-xs text-black/40 dark:text-white/40 mt-1">
                Para la cuenta <strong className="text-black/60 dark:text-white/60">{email}</strong>
              </p>
            )}
          </CardHeader>

          <CardBody className="px-8 pb-10">

            {/* ── VERIFYING ── */}
            {stage === "verifying" && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-black/50 dark:text-white/50">Validando tu enlace de recuperación…</p>
              </div>
            )}

            {/* ── INVALID ── */}
            {stage === "invalid" && (
              <div className="flex flex-col items-center gap-5 py-4 text-center">
                <p className="text-sm text-black/60 dark:text-white/60 leading-relaxed">
                  {errorMsg}
                </p>
                <Button
                  color="primary"
                  className="font-bold text-white h-11 shadow-lg shadow-primary/20 w-full"
                  onClick={() => navigate("/login")}
                >
                  Solicitar nuevo enlace
                </Button>
              </div>
            )}

            {/* ── FORM ── */}
            {stage === "form" && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <Input
                    id="new-password"
                    type={showPass ? "text" : "password"}
                    label="Nueva contraseña"
                    variant="bordered"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    isRequired
                    autoFocus
                    endContent={
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="text-black/30 dark:text-white/30 hover:text-primary transition-colors text-xs font-bold"
                      >
                        {showPass ? "Ocultar" : "Ver"}
                      </button>
                    }
                    classNames={{
                      inputWrapper: "border-black/10 dark:border-white/10 hover:border-primary transition-colors",
                    }}
                  />
                  {/* Barra de fortaleza */}
                  <div className="h-1 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${strengthColor()}`}
                      style={{ width: strengthWidth() }}
                    />
                  </div>
                  <p className="text-[10px] text-black/30 dark:text-white/30">
                    Mínimo 8 caracteres · Más larga = más segura
                  </p>
                </div>

                <Input
                  id="confirm-password"
                  type={showPass ? "text" : "password"}
                  label="Confirmar contraseña"
                  variant="bordered"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  isRequired
                  color={confirm && confirm !== password ? "danger" : "default"}
                  classNames={{
                    inputWrapper: "border-black/10 dark:border-white/10 hover:border-primary transition-colors",
                  }}
                />

                {formError && (
                  <p className="text-danger text-xs font-medium bg-danger/10 p-2 rounded-lg text-center">
                    {formError}
                  </p>
                )}

                <Button
                  type="submit"
                  color="primary"
                  className="mt-2 font-bold text-white shadow-lg shadow-primary/20 h-12"
                  isLoading={isLoading}
                >
                  Restablecer contraseña
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    className="text-xs text-black/40 dark:text-white/40 hover:text-primary transition-colors"
                    onClick={() => navigate("/login")}
                  >
                    ← Volver al inicio de sesión
                  </button>
                </div>
              </form>
            )}

            {/* ── SUCCESS ── */}
            {stage === "success" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-5 py-4 text-center"
              >
                <p className="text-sm text-black/60 dark:text-white/60 leading-relaxed">
                  Tu contraseña ha sido restablecida correctamente.
                  <br />Ya puedes iniciar sesión con tu nueva contraseña.
                </p>
                <Button
                  color="primary"
                  className="font-bold text-white h-11 shadow-lg shadow-primary/20 w-full"
                  onClick={() => navigate("/login")}
                >
                  Ir al inicio de sesión
                </Button>
              </motion.div>
            )}

          </CardBody>
        </Card>
      </motion.div>
    </div>
  );
}
