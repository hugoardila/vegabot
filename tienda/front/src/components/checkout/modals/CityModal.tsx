import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalHeader, ModalBody } from "@heroui/modal";
import { Input } from "@heroui/input";
import { CheckIcon } from "../CheckoutIcons";

interface CityModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  cities: string[];
  department: string;
  pendingCity: string;
  onPendingCityChange: (city: string) => void;
  onConfirm: () => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

export function CityModal({
  isOpen,
  onOpenChange,
  cities,
  department,
  pendingCity,
  onPendingCityChange,
  onConfirm,
  searchQuery = "",
  onSearchQueryChange,
}: CityModalProps) {
  const filteredCities = searchQuery
    ? cities.filter(city =>
        city.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : cities;
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      backdrop="opaque"
      scrollBehavior="inside"
      className="dark:bg-[#0a0a0a] bg-white border border-white/10"
      size="sm"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 text-black dark:text-white">
              <span className="text-xl">Selecciona el municipio</span>
              <p className="text-xs font-normal text-black/50 dark:text-white/50">
                {department ? `Municipios de ${department}` : "Selecciona un municipio"}
              </p>
              {onSearchQueryChange && (
                <Input
                  placeholder="🔍 Buscar municipio..."
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
              <div className="flex flex-col gap-2">
                {filteredCities.length > 0 ? (
                  filteredCities.map((cityName) => (
                  <button
                    key={cityName}
                    onClick={() => onPendingCityChange(cityName)}
                    className={`flex items-center justify-between gap-2 px-4 py-3 rounded-2xl border-2 text-left transition-all duration-150 ${
                      pendingCity === cityName
                        ? "border-primary bg-primary/10 text-primary shadow-md shadow-primary/15"
                        : "border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-black dark:text-white hover:border-primary/40"
                    }`}
                  >
                    <span className="font-semibold text-sm">{cityName}</span>
                    {pendingCity === cityName && (
                      <span className="text-primary shrink-0"><CheckIcon size={18} /></span>
                    )}
                  </button>
                  ))
                ) : (
                  <div className="text-center py-8 text-black/40 dark:text-white/40 text-sm">
                    No se encontraron municipios
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-4">
                <Button
                  className="flex-1 font-bold bg-primary text-white h-12 rounded-xl"
                  isDisabled={!pendingCity}
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
