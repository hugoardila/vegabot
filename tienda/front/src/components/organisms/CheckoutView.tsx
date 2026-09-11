import React, { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { CartItem } from "../../types";
import { formatPrice } from "../../utils/format";
import { ChevronLeft, PhoneIcon, UserIcon } from "../atoms/icons";
import { CARRIERS } from "../../data/carriers";
import { CarrierLogo } from "../checkout/CarrierLogo";
import { isValidCheckoutPhone, normalizeCheckoutPhone } from "../../utils/phone";

// ─── Address icon ─────────────────────────────────────────────────────────────
const AddressIcon = ({ size = 20 }: { size?: number }) => (
  <svg
    fill="none"
    height={size}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

// ─── Store / Truck icons ──────────────────────────────────────────────────────
const StoreIcon = ({ size = 28 }: { size?: number }) => (
  <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const TruckIcon = ({ size = 28 }: { size?: number }) => (
  <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3" />
    <rect height="8" rx="2" width="9" x="11" y="11" />
    <circle cx="7" cy="17" r="2" />
    <circle cx="17" cy="17" r="2" />
    <path d="M22 11V9" />
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────
type DeliveryMethod = "pickup" | "shipping";

interface CheckoutViewProps {
  cart: CartItem[];
  total: number;
  subtotal: number;
  isSubmitting: boolean;
  onBack: () => void;
  /** method will be "Recoger en tienda" or the carrier name */
  onConfirm: (
    method: string,
    customerName: string,
    customerPhone: string,
    address: string
  ) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const CheckoutView: React.FC<CheckoutViewProps> = ({
  cart,
  total,
  subtotal,
  isSubmitting,
  onBack,
  onConfirm,
}) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [delivery, setDelivery] = useState<DeliveryMethod | null>(null);
  const [carrier, setCarrier] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Nombre requerido";
    if (!phone.trim()) e.phone = "Teléfono requerido";
    else if (!isValidCheckoutPhone(phone)) e.phone = "Ingresa exactamente 10 dígitos";
    if (!delivery) e.delivery = "Selecciona cómo recibirás tu pedido";
    if (delivery === "shipping" && !carrier) e.carrier = "Selecciona la transportadora";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleConfirm = () => {
    if (!validate()) return;
    const method =
      delivery === "pickup" ? "Recoger en tienda" : carrier ?? "Envío";
    onConfirm(method, name, phone, address);
  };

  const itemCount = cart.reduce((a, b) => a + b.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#0a0a0a] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md border-b border-black/10 dark:border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="text-black/50 dark:text-white/50 hover:text-primary dark:hover:text-primary transition-colors p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5">
          <ChevronLeft size={22} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-black dark:text-white">Completar pedido</h1>
          <p className="text-xs text-black/40 dark:text-white/40">{itemCount} producto{itemCount !== 1 ? "s" : ""} · Total: ${formatPrice(total)}</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-6 flex flex-col gap-8">

        {/* ── Section 1: Customer data ───────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-black/60 dark:text-white/60 uppercase tracking-widest mb-4">
            Tus datos
          </h2>
          <div className="flex flex-col gap-3">
            <Input
              label="Nombre completo"
              placeholder="Ej: Juan Pérez"
              value={name}
              onValueChange={setName}
              startContent={<UserIcon size={16} />}
              isInvalid={!!errors.name}
              errorMessage={errors.name}
              variant="flat"
              classNames={{ inputWrapper: "bg-black/5 dark:bg-white/8" }}
            />
            <Input
              label="Teléfono"
              placeholder="Ej: 3001234567"
              value={phone}
              onValueChange={(value) => setPhone(normalizeCheckoutPhone(value))}
              startContent={<PhoneIcon size={16} />}
              isInvalid={!!errors.phone}
              errorMessage={errors.phone}
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              variant="flat"
              classNames={{ inputWrapper: "bg-black/5 dark:bg-white/8" }}
            />
            <Input
              label="Dirección / Nota (opcional)"
              placeholder="Ej: Calle 10 # 5-23, Barrio Centro"
              value={address}
              onValueChange={setAddress}
              startContent={<AddressIcon size={16} />}
              variant="flat"
              classNames={{ inputWrapper: "bg-black/5 dark:bg-white/8" }}
            />
          </div>
        </section>

        {/* ── Section 2: Delivery method ──────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-black/60 dark:text-white/60 uppercase tracking-widest mb-4">
            ¿Cómo recibirás tu pedido?
          </h2>
          {errors.delivery && (
            <p className="text-danger text-xs mb-3 font-medium">{errors.delivery}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {/* Pickup */}
            <button
              onClick={() => { setDelivery("pickup"); setCarrier(null); }}
              className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-200 ${
                delivery === "pickup"
                  ? "border-primary bg-primary/10 text-primary shadow-lg shadow-primary/20 scale-[1.02]"
                  : "border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black dark:text-white hover:border-primary/50"
              }`}
            >
              <StoreIcon size={32} />
              <div className="text-center">
                <p className="font-bold text-sm">Recoger</p>
                <p className="text-[11px] opacity-60">en la tienda</p>
              </div>
            </button>

            {/* Shipping */}
            <button
              onClick={() => setDelivery("shipping")}
              className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-200 ${
                delivery === "shipping"
                  ? "border-primary bg-primary/10 text-primary shadow-lg shadow-primary/20 scale-[1.02]"
                  : "border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black dark:text-white hover:border-primary/50"
              }`}
            >
              <TruckIcon size={32} />
              <div className="text-center">
                <p className="font-bold text-sm">Envío</p>
                <p className="text-[11px] opacity-60">por transportadora</p>
              </div>
            </button>
          </div>
        </section>

        {/* ── Section 3: Carrier selection (animated) ─────────────────────── */}
        <section
          className="overflow-hidden transition-all duration-300"
          style={{ maxHeight: delivery === "shipping" ? "800px" : "0px", opacity: delivery === "shipping" ? 1 : 0 }}
        >
          <h2 className="text-sm font-bold text-black/60 dark:text-white/60 uppercase tracking-widest mb-4">
            Selecciona la transportadora
          </h2>
          {errors.carrier && (
            <p className="text-danger text-xs mb-3 font-medium">{errors.carrier}</p>
          )}
          <div className="flex flex-col gap-2">
            {CARRIERS.map((c) => (
              <button
                key={c.id}
                onClick={() => setCarrier(c.name)}
                className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl border-2 text-left transition-all duration-200 ${
                  carrier === c.name
                    ? "border-primary bg-primary/10 text-primary shadow-md shadow-primary/15"
                    : "border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black dark:text-white hover:border-primary/40"
                }`}
              >
                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center overflow-hidden rounded-lg bg-white/80 dark:bg-white/10 p-1">
                  <CarrierLogo src={c.img} name={c.name} />
                </div>
                <span className="font-semibold text-sm">{c.name}</span>
                {carrier === c.name && (
                  <span className="ml-auto text-primary">
                    <svg fill="none" height={18} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width={18}><path d="M20 6 9 17l-5-5" /></svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* ── Order summary ────────────────────────────────────────────────── */}
        <section className="bg-black/5 dark:bg-white/5 rounded-2xl p-4 border border-black/8 dark:border-white/8">
          <h2 className="text-sm font-bold text-black/60 dark:text-white/60 uppercase tracking-widest mb-3">
            Resumen
          </h2>
          <div className="flex flex-col gap-1.5 text-xs text-black/70 dark:text-white/70">
            {cart.map((item) => (
              <div key={item.product.id} className="flex justify-between">
                <span>{item.product.name} × {item.quantity}</span>
                <span>${formatPrice(item.product.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-black/10 dark:border-white/10 mt-3 pt-3 flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-black/60 dark:text-white/60">
              <span>Subtotal</span>
              <span>${formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between font-bold text-base text-black dark:text-white">
              <span>Total</span>
              <span className="text-primary">${formatPrice(total)}</span>
            </div>
          </div>
        </section>

        {/* ── Confirm button ────────────────────────────────────────────────── */}
        <Button
          className="w-full h-14 text-base font-bold bg-primary text-white rounded-2xl shadow-lg shadow-primary/30 hover:scale-[1.01] transition-transform"
          onClick={handleConfirm}
          isDisabled={isSubmitting}
          isLoading={isSubmitting}
        >
          {isSubmitting ? "Procesando pedido…" : "Confirmar pedido"}
        </Button>
      </div>
    </div>
  );
};
