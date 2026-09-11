import { motion } from "framer-motion";
import { StoreIcon, TruckIcon, CheckIcon } from "./CheckoutIcons";
import { CarrierLogo } from "./CarrierLogo";
import { DeliveryMethod } from "../../types/checkout";
import { CARRIERS } from "../../hooks/useCheckout";

interface DeliveryMethodSectionProps {
  delivery: DeliveryMethod | null;
  carrier: string | null;
  errors: {
    delivery?: string;
    carrier?: string;
  };
  onSelectPickup: () => void;
  onSelectShipping: () => void;
  onOpenCarrierModal: () => void;
}

export function DeliveryMethodSection({
  delivery,
  carrier,
  errors,
  onSelectPickup,
  onSelectShipping,
  onOpenCarrierModal,
}: DeliveryMethodSectionProps) {
  return (
    <section>
      <h3 className="text-[10px] font-bold opacity-50 uppercase tracking-widest mb-4">
        ¿Cómo recibirás tu pedido?
      </h3>
      {errors.delivery && (
        <p className="text-danger text-xs mb-3 font-medium">{errors.delivery}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* Recoger en tienda */}
        <button
          onClick={onSelectPickup}
          className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-200 ${
            delivery === "pickup"
              ? "border-primary bg-primary/10 text-primary shadow-lg shadow-primary/20 scale-[1.02]"
              : "border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black dark:text-white hover:border-primary/50"
          }`}
        >
          <StoreIcon size={30} />
          <div className="text-center">
            <p className="font-bold text-sm">Recoger</p>
            <p className="text-[11px] opacity-60">en la tienda</p>
          </div>
        </button>

        {/* Enviar por transportadora → abre modal */}
        <button
          onClick={onSelectShipping}
          className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-200 ${
            delivery === "shipping"
              ? "border-primary bg-primary/10 text-primary shadow-lg shadow-primary/20 scale-[1.02]"
              : "border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black dark:text-white hover:border-primary/50"
          }`}
        >
          <TruckIcon size={30} />
          <div className="text-center">
            <p className="font-bold text-sm">Envío</p>
            <p className="text-[11px] opacity-60">por transportadora</p>
          </div>
        </button>
      </div>

      {/* Show selected carrier chip */}
      {delivery === "shipping" && carrier && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-center gap-2"
        >
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-bold border border-primary/30">
            <CheckIcon size={14} />
            {CARRIERS.find(c => c.name === carrier)?.img && (
              <CarrierLogo
                src={CARRIERS.find(c => c.name === carrier)!.img}
                name={carrier}
                className="h-5 w-5"
              />
            )}
            {carrier}
          </div>
          <button
            onClick={onOpenCarrierModal}
            className="text-xs text-black/40 dark:text-white/40 hover:text-primary underline underline-offset-2 transition-colors"
          >
            Cambiar
          </button>
        </motion.div>
      )}

      {errors.carrier && (
        <p className="text-danger text-xs mt-2 font-medium">{errors.carrier}</p>
      )}
    </section>
  );
}
