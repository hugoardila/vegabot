import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon } from "./CheckoutIcons";
import { PAYMENT_METHODS } from "../../hooks/useCheckout";

interface PaymentMethodSectionProps {
  paymentMethod: string | null;
  copiedNumber: string | null;
  bankInfo: string;
  paymentTerms: string;
  errors: {
    payment?: string;
  };
  onSelectPayment: (method: string) => void;
  onCopyNumber: (text: string) => void;
}

type PaymentAccount = "nequi" | "bancolombia";

function classifyPaymentHeading(line: string): PaymentAccount | null {
  const normalized = line
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (/^nequi\b/.test(normalized)) return "nequi";
  if (/^(?:cuenta\s+)?bancolombia\b/.test(normalized)) return "bancolombia";
  if (/^banco\s*:?\s*bancolombia\b/.test(normalized)) return "bancolombia";
  return null;
}

function getPaymentAccountLines(bankInfo: string, paymentMethod: string | null) {
  const lines = bankInfo
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const target: PaymentAccount | null =
    paymentMethod === "Nequi"
      ? "nequi"
      : paymentMethod === "Bancolombia"
        ? "bancolombia"
        : null;

  if (!target || lines.length === 0) return lines;

  const start = lines.findIndex((line) => classifyPaymentHeading(line) === target);
  if (start < 0) return lines;

  const nextHeading = lines.findIndex(
    (line, index) => index > start && classifyPaymentHeading(line) !== null,
  );

  return lines.slice(start, nextHeading < 0 ? undefined : nextHeading);
}

function findAccountNumber(lines: string[]) {
  for (const line of lines) {
    const candidates = line.match(/(?:\d[\s.-]?){6,}/g) || [];
    for (const candidate of candidates) {
      const digits = candidate.replace(/\D/g, "");
      if (digits.length >= 6) return digits;
    }
  }
  return "";
}

export function PaymentMethodSection({
  paymentMethod,
  copiedNumber,
  bankInfo,
  paymentTerms,
  errors,
  onSelectPayment,
  onCopyNumber,
}: PaymentMethodSectionProps) {
  const isCashOnDelivery = paymentMethod === "Contraentrega";
  const accountLines = getPaymentAccountLines(bankInfo, paymentMethod);
  const accountNumber = findAccountNumber(accountLines);

  return (
    <section>
      <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest opacity-50">
        ¿Cómo deseas pagar?
      </h3>
      {errors.payment && (
        <p className="mb-3 text-xs font-medium text-danger">{errors.payment}</p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PAYMENT_METHODS.map((pm) => (
          <button
            key={pm.id}
            className={`relative flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all duration-200 ${
              paymentMethod === pm.name
                ? "scale-[1.02] border-primary bg-primary/5 text-primary shadow-md shadow-primary/20"
                : "border-black/5 bg-black/5 text-black hover:border-black/10 dark:border-white/5 dark:bg-white/5 dark:text-white dark:hover:border-white/10"
            }`}
            type="button"
            onClick={() => onSelectPayment(pm.name)}
          >
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden">
              {pm.img ? (
                <img
                  src={pm.img}
                  alt={pm.name}
                  className="h-full w-full object-contain mix-blend-multiply dark:mix-blend-normal"
                  onError={(event) => {
                    (event.target as HTMLImageElement).style.display = "none";
                    const fallback = (event.target as HTMLImageElement).nextElementSibling as HTMLElement;
                    if (fallback) {
                      fallback.classList.remove("hidden");
                      fallback.classList.add("flex");
                    }
                  }}
                />
              ) : null}
              <span className={`h-full w-full items-center justify-center text-3xl font-black ${pm.img ? "hidden" : "flex"}`}>
                {pm.emoji}
              </span>
            </div>
            <p className="text-center text-sm font-bold leading-tight">{pm.name}</p>
            {pm.note && (
              <span className="text-center text-[10px] font-semibold opacity-65">{pm.note}</span>
            )}
            {paymentMethod === pm.name && (
              <div className="absolute right-3 top-3 text-primary">
                <CheckIcon size={18} />
              </div>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {paymentMethod && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 24 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <div className={`mb-6 flex flex-col gap-1 rounded-lg border p-5 text-black/80 dark:text-white/80 ${
              isCashOnDelivery
                ? "border-success/25 bg-success/10"
                : "border-primary/20 bg-primary/5"
            }`}>
              {isCashOnDelivery ? (
                <>
                  <h4 className="mb-1 text-xs font-black text-success">
                    Pago contraentrega habilitado
                  </h4>
                  <p className="text-sm">
                    Paga en efectivo cuando recibas tu pedido. No necesitas adjuntar comprobante.
                  </p>
                </>
              ) : (
                <>
                  <h4 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-black opacity-50 dark:text-white">
                    Datos para transferencia
                  </h4>
                  {accountLines.length > 0 ? (
                    <div className="mt-1 flex flex-col gap-1">
                      {accountLines.map((line, index) => (
                        <p
                          key={`${line}-${index}`}
                          className={index === 0 ? "text-sm font-bold text-primary" : "text-sm"}
                        >
                          {line}
                        </p>
                      ))}
                      {accountNumber && (
                        <button
                          className="mt-2 w-fit rounded-md bg-black/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary transition-colors hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20"
                          type="button"
                          onClick={() => onCopyNumber(accountNumber)}
                        >
                          {copiedNumber === accountNumber ? "¡Copiado!" : "Copiar número"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-danger">
                      Los datos de pago todavía no están configurados. Contacta al asesor.
                    </p>
                  )}
                  {paymentTerms && (
                    <p className="mt-3 border-t border-black/10 pt-3 text-xs opacity-70 dark:border-white/10">
                      {paymentTerms}
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
