import React from "react";
import { Modal, ModalContent, ModalBody } from "@heroui/modal";
import { RouletteView } from "../../../pages/roulette";
import { Button } from "@heroui/button";

interface RouletteModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const RouletteModal: React.FC<RouletteModalProps> = ({ isOpen, onOpenChange }) => {
  return (
    <Modal 
      isOpen={isOpen} 
      onOpenChange={onOpenChange} 
      size="5xl" 
      backdrop="blur"
      scrollBehavior="inside"
      className="bg-transparent shadow-none"
      hideCloseButton
    >
      <ModalContent className="p-0 m-0 relative">
        <ModalBody className="p-0 m-0">
          {/* Close button inside the view, top-right of the card */}
          <div className="absolute top-6 right-6 z-[60]">
             <Button
                isIconOnly
                variant="flat"
                className="bg-black/5 dark:bg-white/10 backdrop-blur-md rounded-full shadow-lg border border-white/10 active:scale-95 transition-all"
                onClick={() => onOpenChange(false)}
             >
               <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                 <path d="M18 6L6 18M6 6l12 12" />
               </svg>
             </Button>
          </div>
          <RouletteView isDashboardView={true} />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
