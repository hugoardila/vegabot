import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Boxes, DollarSign, RotateCcw, SlidersHorizontal } from "lucide-react";
import clsx from "clsx";
import { Product } from "../../../types";
import { CatalogFilters, emptyCatalogFilters, StockFilterMode } from "../../../utils/catalogFilters";

interface CatalogFilterModalProps {
  filters: CatalogFilters;
  isOpen: boolean;
  products: Product[];
  onApply: (filters: CatalogFilters) => void;
  onOpenChange: (isOpen: boolean) => void;
}

const stockOptions: Array<{ value: StockFilterMode; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "available", label: "Disponibles" },
  { value: "out", label: "Agotados" },
  { value: "low", label: "Pocas unidades" },
];

export const CatalogFilterModal: React.FC<CatalogFilterModalProps> = ({
  filters,
  isOpen,
  products,
  onApply,
  onOpenChange,
}) => {
  const [draft, setDraft] = useState<CatalogFilters>(filters);
  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category_name).filter(Boolean) as string[])]
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    [products],
  );

  useEffect(() => {
    if (isOpen) setDraft(filters);
  }, [filters, isOpen]);

  const setNumericValue = (field: "minStock" | "maxStock" | "minPrice" | "maxPrice", value: string) => {
    setDraft((current) => ({ ...current, [field]: value.replace(/[^\d]/g, "") }));
  };

  return (
    <Modal
      backdrop="blur"
      isOpen={isOpen}
      placement="center"
      scrollBehavior="inside"
      size="lg"
      onOpenChange={onOpenChange}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-3 border-b border-black/5 dark:border-white/10">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <SlidersHorizontal size={20} />
              </span>
              <div>
                <p className="text-base font-bold">Filtrar productos</p>
                <p className="text-xs font-normal text-black/50 dark:text-white/50">
                  Ajusta existencias, precios y orden del catálogo
                </p>
              </div>
            </ModalHeader>

            <ModalBody className="gap-5 py-5">
              <section>
                <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                  <Boxes className="text-primary" size={17} />
                  Disponibilidad
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {stockOptions.map((option) => (
                    <button
                      className={clsx(
                        "h-10 rounded-md border px-2 text-xs font-semibold transition-colors",
                        draft.stockMode === option.value
                          ? "border-primary bg-primary text-white"
                          : "border-black/10 bg-black/[0.03] text-black/65 hover:border-primary/40 dark:border-white/10 dark:bg-white/5 dark:text-white/65",
                      )}
                      key={option.value}
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, stockMode: option.value }))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <p className="mb-2 text-sm font-bold">Rango de existencias</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Cantidad mínima"
                    min={0}
                    placeholder="Ejemplo: 5"
                    type="number"
                    value={draft.minStock}
                    variant="bordered"
                    onValueChange={(value) => setNumericValue("minStock", value)}
                  />
                  <Input
                    label="Cantidad máxima"
                    min={0}
                    placeholder="Ejemplo: 20"
                    type="number"
                    value={draft.maxStock}
                    variant="bordered"
                    onValueChange={(value) => setNumericValue("maxStock", value)}
                  />
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                  <DollarSign className="text-success" size={17} />
                  Rango de precio detal
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Precio mínimo"
                    min={0}
                    placeholder="$0"
                    type="number"
                    value={draft.minPrice}
                    variant="bordered"
                    onValueChange={(value) => setNumericValue("minPrice", value)}
                  />
                  <Input
                    label="Precio máximo"
                    min={0}
                    placeholder="$500.000"
                    type="number"
                    value={draft.maxPrice}
                    variant="bordered"
                    onValueChange={(value) => setNumericValue("maxPrice", value)}
                  />
                </div>
              </section>

              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-black/60 dark:text-white/60">
                  Categoría
                  <select
                    className="h-12 rounded-lg border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-primary dark:border-white/10 dark:bg-[#121212] dark:text-white"
                    value={draft.category}
                    onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                  >
                    <option value="">Todas las categorías</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold text-black/60 dark:text-white/60">
                  Ordenar por
                  <select
                    className="h-12 rounded-lg border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-primary dark:border-white/10 dark:bg-[#121212] dark:text-white"
                    value={draft.sort}
                    onChange={(event) => setDraft((current) => ({ ...current, sort: event.target.value as CatalogFilters["sort"] }))}
                  >
                    <option value="relevance">Relevancia</option>
                    <option value="price_asc">Menor precio</option>
                    <option value="price_desc">Mayor precio</option>
                    <option value="stock_asc">Menor existencia</option>
                    <option value="stock_desc">Mayor existencia</option>
                    <option value="name_asc">Nombre A-Z</option>
                  </select>
                </label>
              </section>
            </ModalBody>

            <ModalFooter className="border-t border-black/5 dark:border-white/10">
              <Button
                startContent={<RotateCcw size={16} />}
                variant="flat"
                onPress={() => setDraft(emptyCatalogFilters)}
              >
                Limpiar
              </Button>
              <Button
                className="font-bold"
                color="primary"
                startContent={<SlidersHorizontal size={16} />}
                onPress={() => {
                  const appliedFilters = { ...draft };
                  onClose();
                  onOpenChange(false);
                  window.setTimeout(() => onApply(appliedFilters), 180);
                }}
              >
                Aplicar filtros
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
