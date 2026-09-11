import { useState, useEffect, useCallback } from "react";
import { Button } from "@heroui/button";
import { API_URL } from "../../config/api";
import { useAuth } from "../../context/AuthContext";

const PAYMENT_WINDOW_MINUTES = 30;
const PAYMENT_WINDOW_MS = PAYMENT_WINDOW_MINUTES * 60 * 1000;

interface PaymentCountdownBannerProps {
  saleId: string;
  createdAt: string;
  onExpired?: () => void;
  onPaymentStarted?: () => void;
}

function getSecondsLeft(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const elapsed = now - created;
  return Math.max(0, Math.floor((PAYMENT_WINDOW_MS - elapsed) / 1000));
}

export function PaymentCountdownBanner({
  saleId,
  createdAt,
  onExpired,
  onPaymentStarted,
}: PaymentCountdownBannerProps) {
  const { token } = useAuth();
  const [secondsLeft, setSecondsLeft] = useState(() => getSecondsLeft(createdAt));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // ── Intervalo del temporizador ──────────────────────────────────────────────
  useEffect(() => {
    if (secondsLeft <= 0) return;

    const interval = setInterval(() => {
      const remaining = getSecondsLeft(createdAt);
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onExpired?.();
      }
    }, 1000);

    return () => clearInterval(interval); // limpieza al desmontar
  }, [createdAt, onExpired, secondsLeft]);

  // ── Formato MM:SS ───────────────────────────────────────────────────────────
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // ── Urgencia visual ─────────────────────────────────────────────────────────
  const isUrgent = secondsLeft > 0 && secondsLeft <= 300; // últimos 5 min
  const isExpired = secondsLeft <= 0;

  // ── Handler pagar ahora ─────────────────────────────────────────────────────
  const handlePayNow = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/pedidos/${saleId}/pagar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || "No se pudo iniciar el pago. Intenta de nuevo.");
      }

      const payUrl = data.url_pago || data.payment_url || data.url;
      if (!payUrl) throw new Error("El servidor no devolvió una URL de pago válida.");

      onPaymentStarted?.();
      window.location.href = payUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }, [saleId, token, onPaymentStarted]);

  if (dismissed) return null;

  // ── Estado expirado ─────────────────────────────────────────────────────────
  if (isExpired) {
    return (
      <div className="mt-3 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/30 p-3 flex items-center gap-3">
        <span className="text-lg">⏰</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-red-600 dark:text-red-400">
            Tiempo de pago expirado
          </p>
          <p className="text-[11px] text-red-500/70 dark:text-red-400/60">
            Este pedido fue cancelado automáticamente por el sistema.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-red-400 hover:text-red-600 transition-colors text-base flex-shrink-0"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>
    );
  }

  // ── Estado activo con cuenta regresiva ──────────────────────────────────────
  return (
    <div
      className={`mt-3 rounded-xl border p-3 flex flex-col gap-2.5 transition-all duration-500 ${
        isUrgent
          ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 animate-pulse-slow"
          : "border-amber-300 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/30"
      }`}
    >
      {/* Cabecera: icono + texto + reloj */}
      <div className="flex items-center gap-2.5">
        <span className={`text-xl flex-shrink-0 ${isUrgent ? "animate-bounce" : ""}`}>
          {isUrgent ? "🚨" : "⏳"}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold leading-tight ${isUrgent ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
            {isUrgent ? "¡Último momento para pagar!" : "Pago pendiente — completa tu compra"}
          </p>
          <p className={`text-[11px] mt-0.5 ${isUrgent ? "text-red-500/70 dark:text-red-400/60" : "text-amber-600/70 dark:text-amber-400/60"}`}>
            Este pedido se cancelará si no se paga a tiempo.
          </p>
        </div>
        {/* Reloj MM:SS */}
        <div
          className={`flex-shrink-0 font-mono font-black text-xl tabular-nums px-3 py-1.5 rounded-lg ${
            isUrgent
              ? "bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300"
              : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
          }`}
          aria-label={`Tiempo restante: ${formatTime(secondsLeft)}`}
        >
          {formatTime(secondsLeft)}
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${isUrgent ? "bg-red-500" : "bg-amber-400"}`}
          style={{ width: `${(secondsLeft / (PAYMENT_WINDOW_MINUTES * 60)) * 100}%` }}
        />
      </div>

      {/* Botón + mensaje de error */}
      <div className="flex flex-col gap-1.5">
        <Button
          size="sm"
          className={`w-full font-bold h-9 text-white shadow-md transition-transform active:scale-95 ${
            isUrgent
              ? "bg-red-500 shadow-red-500/30 hover:bg-red-600"
              : "bg-amber-500 shadow-amber-500/30 hover:bg-amber-600"
          }`}
          onPress={handlePayNow}
          isDisabled={isLoading}
          isLoading={isLoading}
        >
          {isLoading ? "Obteniendo enlace de pago..." : "💳 Pagar Ahora"}
        </Button>

        {error && (
          <div className="flex items-start gap-1.5 rounded-lg bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800/50 px-2.5 py-2">
            <span className="text-red-500 mt-0.5 flex-shrink-0">⚠️</span>
            <p className="text-[11px] text-red-600 dark:text-red-400 leading-tight">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600 transition-colors flex-shrink-0 text-xs"
              aria-label="Cerrar error"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
