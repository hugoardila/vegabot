import React from "react";
import { Modal, ModalContent, ModalHeader, ModalBody } from "@heroui/modal";
import { Button } from "@heroui/button";
import { Building2, CreditCard, Truck } from "lucide-react";

interface PaymentSelectionModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  handleCheckout: (method?: string) => void;
  onDirectOwner: () => void;
  onWompiCheckout: () => void;
}

export const PaymentSelectionModal: React.FC<PaymentSelectionModalProps> = ({
  isOpen,
  onOpenChange,
  onDirectOwner,
  onWompiCheckout,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      backdrop="opaque"
      className="border border-white/10 bg-white dark:bg-[#0a0a0a]"
      size="md"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 text-xl text-black dark:text-white">
              ¿Cómo deseas pagar?
            </ModalHeader>
            <ModalBody className="pb-8">
              <p className="mb-4 text-sm text-black/60 dark:text-white/60">
                Selecciona cómo deseas completar el pago de tu orden.
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  className="h-auto min-h-20 justify-start gap-4 rounded-lg bg-primary px-5 py-4 text-left text-white shadow-lg shadow-primary/30 transition-transform hover:scale-[1.01]"
                  onClick={() => {
                    onClose();
                    onDirectOwner();
                  }}
                >
                  <Building2 aria-hidden="true" className="shrink-0" size={24} />
                  <span className="flex min-w-0 flex-col items-start gap-1">
                    <span className="text-base font-bold">Pagar directo con la empresa</span>
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
                      <Truck aria-hidden="true" size={13} />
                      Pago contraentrega habilitado
                    </span>
                  </span>
                </Button>

                <Button
                  className="h-auto min-h-20 justify-start gap-4 rounded-lg bg-gradient-to-r from-[#00D4AA] to-[#00B894] px-5 py-4 text-left text-white shadow-lg shadow-[#00D4AA]/30 transition-transform hover:scale-[1.01]"
                  onClick={() => {
                    onClose();
                    onWompiCheckout();
                  }}
                >
                  <CreditCard aria-hidden="true" className="shrink-0" size={24} />
                  <span className="flex min-w-0 flex-col items-start gap-1">
                    <span className="text-base font-bold">Pagar con Wompi</span>
                    <span className="text-[11px] font-semibold text-white/80">
                      Tarjeta, PSE y Nequi
                    </span>
                  </span>
                </Button>
              </div>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
