import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalHeader, ModalBody } from "@heroui/modal";
import { Input } from "@heroui/input";
import { CheckIcon } from "../CheckoutIcons";

interface DepartmentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  departments: string[];
  pendingDepartment: string;
  onPendingDepartmentChange: (dept: string) => void;
  onConfirm: () => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

export function DepartmentModal({
  isOpen,
  onOpenChange,
  departments,
  pendingDepartment,
  onPendingDepartmentChange,
  onConfirm,
  searchQuery = "",
  onSearchQueryChange,
}: DepartmentModalProps) {
  const filteredDepartments = searchQuery
    ? departments.filter(dept =>
        dept.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : departments;
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      backdrop="opaque"
      scrollBehavior="inside"
      className="dark:bg-[#0a0a0a] bg-white border border-white/10"
      size="md"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 text-black dark:text-white">
              <span className="text-xl">Selecciona el departamento</span>
              <p className="text-xs font-normal text-black/50 dark:text-white/50">
                Elige el departamento donde recibirás tu pedido
              </p>
              {onSearchQueryChange && (
                <Input
                  placeholder="🔍 Buscar departamento..."
                  value={searchQuery}
                  onValueChange={onSearchQueryChange}
                  variant="bordered"
                  size="sm"
                  classNames={{
                    input: "text-sm",
                    inputWrapper: "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
                  }}
                />
              )}
            </ModalHeader>
            <ModalBody className="pb-6">
              <div className="grid grid-cols-2 gap-2">
                {filteredDepartments.length > 0 ? (
                  filteredDepartments.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => onPendingDepartmentChange(dept)}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 text-center transition-all duration-150 ${
                      pendingDepartment === dept
                        ? "border-primary bg-primary/10 text-primary shadow-md shadow-primary/15"
                        : "border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black dark:text-white hover:border-primary/40"
                    }`}
                  >
                    <span className="font-semibold text-sm">{dept}</span>
                    {pendingDepartment === dept && (
                      <span className="text-primary shrink-0"><CheckIcon size={16} /></span>
                    )}
                  </button>
                  ))
                ) : (
                  <div className="col-span-2 text-center py-8 text-black/40 dark:text-white/40 text-sm">
                    No se encontraron departamentos
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-4">
                <Button
                  className="flex-1 font-bold bg-primary text-white h-12 rounded-xl"
                  isDisabled={!pendingDepartment}
                  onClick={() => { onConfirm(); onClose(); }}
                >
                  Confirmar
                </Button>
                <Button
                  className="font-bold bg-black/5 dark:bg-white/5 h-12 rounded-xl"
                  variant="flat"
                  onClick={onClose}
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
