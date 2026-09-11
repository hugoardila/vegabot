import React, { useState } from "react";
import { Button } from "@heroui/button";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { BadgeDollarSign, CheckCircle2, Sparkles } from "lucide-react";
import { formatPrice } from "../../utils/format";

interface WholesalePriceCardProps {
  price: number;
  productName?: string;
  compact?: boolean;
  interactive?: boolean;
}

const wholesaleRequirements = [
  "Agrega al menos 2 referencias diferentes.",
  "Lleva 6 unidades o más de cada referencia.",
  "Completa 12 unidades o más en el carrito.",
  "La compra debe superar los $300.000.",
];

export const WholesalePriceCard: React.FC<WholesalePriceCardProps> = ({
  price,
  productName,
  compact = false,
  interactive = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const content = (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-amber-400/30 motion-safe:animate-pulse"
      />
      <span className={`flex items-center justify-center gap-1 font-bold text-amber-700 dark:text-amber-300 ${compact ? "text-[7px] sm:text-[8px]" : "text-[9px] sm:text-[10px]"}`}>
        <Sparkles className="shrink-0 motion-safe:animate-pulse" size={compact ? 9 : 12} />
        Precio mayorista
      </span>
      <span className={`${compact ? (price > 0 ? "mt-1 text-[10px] sm:text-xs" : "mt-1 text-[8px]") : "text-base sm:text-xl"} block break-words font-extrabold leading-tight text-amber-950 dark:text-amber-100`}>
        {price > 0 ? `$${formatPrice(price)}` : "Por consultar"}
      </span>
      {interactive && (
        <span className={`font-semibold text-amber-700/75 dark:text-amber-300/75 ${compact ? "mt-1 block text-[7px]" : "mt-1 block text-[9px]"}`}>
          Ver cómo obtenerlo
        </span>
      )}
    </>
  );

  return (
    <>
      {interactive ? (
        <button
          aria-label={`Ver cómo obtener el precio mayorista${productName ? ` de ${productName}` : ""}`}
          className={`relative min-w-0 overflow-hidden rounded-lg border border-amber-300 bg-amber-50 text-center shadow-sm shadow-amber-200/60 transition duration-200 hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 dark:border-amber-400/30 dark:bg-amber-400/10 dark:shadow-none ${compact ? "p-1" : "p-2"}`}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setIsOpen(true);
          }}
        >
          {content}
        </button>
      ) : (
        <div className={`relative min-w-0 overflow-hidden rounded-lg border border-amber-200 bg-amber-50 text-center shadow-sm shadow-amber-200/40 dark:border-amber-400/20 dark:bg-amber-400/10 dark:shadow-none ${compact ? "p-1" : "p-2"}`}>
          {content}
        </div>
      )}

      <Modal
        backdrop="blur"
        isOpen={isOpen}
        placement="center"
        scrollBehavior="inside"
        size="sm"
        onOpenChange={setIsOpen}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex items-center gap-3 border-b border-black/5 dark:border-white/10">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
                  <BadgeDollarSign size={22} />
                </span>
                <div>
                  <p className="text-base font-bold">Compra al por mayor</p>
                  <p className="text-xs font-normal text-black/50 dark:text-white/50">Accede al mejor precio de forma automática</p>
                </div>
              </ModalHeader>
              <ModalBody className="gap-4 py-5">
                <p className="text-sm leading-6 text-black/65 dark:text-white/65">
                  Para activar los precios mayoristas, tu carrito debe cumplir todas estas condiciones:
                </p>
                <div className="space-y-3">
                  {wholesaleRequirements.map((requirement) => (
                    <div className="flex items-start gap-3" key={requirement}>
                      <CheckCircle2 className="mt-0.5 shrink-0 text-success" size={18} />
                      <span className="text-sm font-medium text-black/75 dark:text-white/75">{requirement}</span>
                    </div>
                  ))}
                </div>
                <p className="rounded-lg bg-success/10 px-3 py-2.5 text-xs font-semibold leading-5 text-success">
                  Cuando cumplas los requisitos, el carrito cambiará automáticamente todos los productos al precio mayorista.
                </p>
              </ModalBody>
              <ModalFooter className="border-t border-black/5 dark:border-white/10">
                <Button className="font-bold" color="warning" onPress={onClose}>
                  Entendido
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};
