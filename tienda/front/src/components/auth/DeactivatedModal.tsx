import { Modal, ModalContent, ModalHeader, ModalBody } from "@heroui/modal";
import { WhatsAppIcon } from "../atoms/icons";

interface DeactivatedModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeactivatedModal({
  isOpen,
  onOpenChange,
}: DeactivatedModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      backdrop="blur"
      className="dark:bg-[#0a0a0a] bg-white border border-danger/20"
      size="sm"
    >
      <ModalContent>
        {(_onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 items-center pt-6">
              <div className="size-12 bg-danger/10 text-danger rounded-full flex items-center justify-center mb-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
              </div>
              <span className="text-xl font-bold text-center text-danger">Cuenta Desactivada</span>
            </ModalHeader>
            <ModalBody className="pb-6 text-center">
              <p className="text-sm text-black/60 dark:text-white/60 mb-4">
                Tu cuenta ha sido suspendida por motivos administrativos o de seguridad. Si crees que esto es un error, por favor comunícate con nosotros.
              </p>
              <a
                href="https://wa.me/573214815817?text=Hola,%20mi%20cuenta%20aparece%20desactivada%20y%20necesito%20ayuda."
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-[#25D366]/30 transition-all active:scale-95"
              >
                <WhatsAppIcon size={20} />
                Contactar por WhatsApp
              </a>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
