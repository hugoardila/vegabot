import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";

interface ConfirmRegisterModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  fullName: string;
  email: string;
  phone: string;
  isLoading: boolean;
  onConfirm: () => void;
}

export function ConfirmRegisterModal({
  isOpen,
  onOpenChange,
  fullName,
  email,
  phone,
  isLoading,
  onConfirm,
}: ConfirmRegisterModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      backdrop="blur"
      className="dark:bg-[#0a0a0a] bg-white border border-black/10 dark:border-white/10"
      size="sm"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <span className="text-lg font-bold text-black dark:text-white">
                ¿Confirmar creación de cuenta?
              </span>
              <p className="text-xs font-normal text-black/50 dark:text-white/50">
                Revisa tus datos antes de continuar
              </p>
            </ModalHeader>

            <ModalBody className="py-4">
              <div className="flex flex-col gap-3 bg-black/5 dark:bg-white/5 rounded-2xl p-4 border border-black/10 dark:border-white/10">
                <div className="flex justify-between text-sm">
                  <span className="text-black/50 dark:text-white/50 font-medium">Nombre</span>
                  <span className="font-bold text-black dark:text-white">{fullName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-black/50 dark:text-white/50 font-medium">Correo</span>
                  <span className="font-bold text-black dark:text-white truncate max-w-[180px]">{email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-black/50 dark:text-white/50 font-medium">Teléfono</span>
                  <span className="font-bold text-black dark:text-white">{phone}</span>
                </div>
              </div>
              <p className="text-[11px] text-black/40 dark:text-white/40 text-center mt-1">
                Podrás editar tu información desde tu perfil después.
              </p>
            </ModalBody>

            <ModalFooter className="flex gap-3 pt-0">
              <Button
                className="flex-1 font-bold bg-primary text-white h-11 rounded-xl shadow-lg shadow-primary/20"
                onClick={onConfirm}
                isLoading={isLoading}
              >
                Confirmar y crear cuenta
              </Button>
              <Button
                className="font-bold bg-black/5 dark:bg-white/5 h-11 rounded-xl"
                variant="flat"
                onClick={onClose}
              >
                Editar datos
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
