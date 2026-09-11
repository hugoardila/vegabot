import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalHeader, ModalBody } from "@heroui/modal";
import { CheckIcon } from "../CheckoutIcons";
import { CarrierLogo } from "../CarrierLogo";
import { CARRIERS } from "../../../hooks/useCheckout";

interface CarrierModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  pendingCarrier: string | null;
  carrier: string | null;
  carrierConfirmedRef: React.MutableRefObject<boolean>;
  onPendingCarrierChange: (carrier: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CarrierModal({
  isOpen,
  onOpenChange,
  pendingCarrier,
  carrier,
  carrierConfirmedRef,
  onPendingCarrierChange,
  onConfirm,
  onCancel,
}: CarrierModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          if (!carrierConfirmedRef.current && !carrier) {
            onCancel();
          }
          carrierConfirmedRef.current = false;
        }
        onOpenChange(open);
      }}
      backdrop="opaque"
      scrollBehavior="inside"
      className="dark:bg-[#0a0a0a] bg-white border border-white/10"
      size="sm"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 text-black dark:text-white">
              <span className="text-xl">Selecciona la transportadora</span>
              <p className="text-xs font-normal text-black/50 dark:text-white/50">
                Elige solo una para enviar tu pedido
              </p>
            </ModalHeader>
            <ModalBody className="pb-6">
              <div className="flex flex-col gap-2">
                {CARRIERS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onPendingCarrierChange(c.name)}
                    className={`flex items-center gap-4 px-4 py-3 rounded-2xl border-2 text-left transition-all duration-150 ${
                      pendingCarrier === c.name
                        ? "border-primary bg-primary/10 text-primary shadow-md shadow-primary/15"
                        : "border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black dark:text-white hover:border-primary/40"
                    }`}
                  >
                    <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center overflow-hidden rounded-lg bg-white/80 dark:bg-white/10 p-1">
                      <CarrierLogo src={c.img} name={c.name} />
                    </div>
                    <span className="font-semibold text-sm flex-1">{c.name}</span>
                    {pendingCarrier === c.name && (
                      <span className="text-primary shrink-0"><CheckIcon size={18} /></span>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 mt-4">
                <Button
                  className="flex-1 font-bold bg-primary text-white h-12 rounded-xl"
                  isDisabled={!pendingCarrier}
                  onClick={() => { onConfirm(); onClose(); }}
                >
                  Confirmar
                </Button>
                <Button
                  className="font-bold bg-black/5 dark:bg-white/5 h-12 rounded-xl"
                  variant="flat"
                  onClick={() => {
                    onCancel();
                    onClose();
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
