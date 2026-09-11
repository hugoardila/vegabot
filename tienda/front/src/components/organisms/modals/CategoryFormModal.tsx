import React, { useState, useEffect } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody } from "@heroui/modal";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Category } from "../../../types";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

// ─── Emoji options ────────────────────────────────────────────────────────────
const EMOJIS = [
  "📁",
  "🗂️",
  "📦",
  "🏷️",
  "🛒",
  "🏪",
  "💎",
  "🎁",
  "💻",
  "📱",
  "🖥️",
  "⌨️",
  "🖱️",
  "🖨️",
  "📷",
  "📹",
  "🎮",
  "🎧",
  "🔋",
  "🔌",
  "📡",
  "💾",
  "📀",
  "💿",
  "☁️",
  "🌐",
  "🔧",
  "⚙️",
  "🧰",
  "🔑",
  "🔐",
  "🛡️",
  "🚀",
  "⚡",
  "💡",
  "🌟",
  "✨",
  "🎯",
  "📊",
  "📝",
  "🔬",
  "🧩",
  "📲",
  "🤖",
  "🎵",
  "🎨",
  "🔊",
  "👾",
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface CategoryFormModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  editingCategory: (Category & { icon?: string }) | null;
  setEditingCategory: React.Dispatch<React.SetStateAction<(Category & { icon?: string }) | null>>;
  isSubmitting: boolean;
  handleSaveCategory: (icon: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  isOpen,
  onOpenChange,
  editingCategory,
  setEditingCategory,
  isSubmitting,
  handleSaveCategory,
}) => {
  // Local icon state — avoids stale-closure issues with ModalContent render prop
  const [localIcon, setLocalIcon] = useState<string>(
    editingCategory?.icon || "📁",
  );

  // Sync local icon whenever the modal opens for a different category
  useEffect(() => {
    setLocalIcon(editingCategory?.icon || "📁");
  }, [editingCategory?.id, isOpen]);

  const categoryName = editingCategory?.name || "";
  const subcategories = editingCategory?.subcategories || [];

  const updateSubcategories = (nextSubcategories: Category["subcategories"]) => {
    setEditingCategory((current) => {
      if (!current) {
        return {
          id: "",
          name: "",
          icon: localIcon,
          subcategories: nextSubcategories || [],
        };
      }
      return { ...current, subcategories: nextSubcategories || [] };
    });
  };

  const moveSubcategory = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= subcategories.length) return;
    const next = [...subcategories];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    updateSubcategories(next);
  };

  return (
    <Modal
      backdrop="opaque"
      className="dark:bg-[#0a0a0a] bg-white border border-black/10 dark:border-white/10"
      isOpen={isOpen}
      scrollBehavior="inside"
      size="lg"
      onOpenChange={onOpenChange}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex items-center gap-3 pb-2 text-black dark:text-white">
              <span className="text-2xl">{localIcon}</span>
              <span>
                {editingCategory?.id ? "Editar Categoría" : "Nueva Categoría"}
              </span>
            </ModalHeader>

            <ModalBody className="pb-6 flex flex-col gap-5">
              {/* ── Nombre ─────────────────────────────────────────────── */}
              <Input
                label="Nombre de la categoría"
                description="Nombre visible en la tienda; la categoría original de SAINT no se modifica."
                placeholder="Ej: Accesorios"
                value={categoryName}
                variant="bordered"
                onChange={(e) => {
                  const newName = e.target.value;
                  setEditingCategory((prev: (Category & { icon?: string }) | null) => {
                    if (!prev) {
                      return { id: "", name: newName, icon: localIcon };
                    }
                    return { ...prev, name: newName };
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && categoryName.trim())
                    handleSaveCategory(localIcon);
                }}
              />

              {/* ── Selector de ícono ──────────────────────────────────── */}
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40 px-0.5">
                  Ícono de la categoría
                </p>

                {/* Preview */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/8 dark:border-white/8">
                  <span className="text-4xl leading-none">{localIcon}</span>
                  <div>
                    <p className="text-sm font-bold text-black dark:text-white">
                      {categoryName.trim() || "Sin nombre"}
                    </p>
                    <p className="text-[10px] text-black/40 dark:text-white/40 mt-0.5">
                      Así se verá en el menú
                    </p>
                  </div>
                </div>

                {/* Grid de emojis */}
                <div
                  className="grid grid-cols-8 gap-1 max-h-44 overflow-y-auto p-1 rounded-xl
                    [&::-webkit-scrollbar]:w-1
                    [&::-webkit-scrollbar-track]:bg-transparent
                    [&::-webkit-scrollbar-thumb]:bg-black/15
                    dark:[&::-webkit-scrollbar-thumb]:bg-white/15
                    [&::-webkit-scrollbar-thumb]:rounded-full"
                >
                  {EMOJIS.map((emoji) => {
                    const isSelected = localIcon === emoji;
                    return (
                      <button
                        key={emoji}
                        type="button"
                        title={emoji}
                        onClick={() => setLocalIcon(emoji)}
                        className={`
                          flex items-center justify-center text-xl rounded-xl
                          aspect-square transition-all duration-150 active:scale-90
                          ${
                            isSelected
                              ? "bg-primary/20 ring-2 ring-primary/50 scale-110 shadow-md shadow-primary/20"
                              : "hover:bg-black/8 dark:hover:bg-white/8"
                          }
                        `}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-black/10 pt-4 dark:border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-black dark:text-white">Subcategorías</p>
                    <p className="text-xs text-black/45 dark:text-white/45">
                      Se mostrarán desplegadas dentro de esta categoría.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="flat"
                    color="primary"
                    startContent={<Plus size={16} />}
                    onClick={() => updateSubcategories([
                      ...subcategories,
                      { id: `new-${Date.now()}`, name: "", icon: "📦", product_count: 0 },
                    ])}
                  >
                    Agregar
                  </Button>
                </div>

                {subcategories.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-black/15 px-4 py-5 text-center text-xs text-black/45 dark:border-white/15 dark:text-white/45">
                    Aún no hay subcategorías. Puedes agregarlas ahora.
                  </p>
                ) : (
                  <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
                    {subcategories.map((subcategory, index) => (
                      <div
                        key={subcategory.id || `subcategory-${index}`}
                        className="flex items-center gap-2"
                      >
                        <select
                          aria-label={`Ícono de ${subcategory.name || "subcategoría"}`}
                          className="h-10 w-20 shrink-0 cursor-pointer rounded-lg border border-black/10 bg-white px-2 text-center text-xl outline-none transition-colors hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-white/10 dark:bg-[#0a0a0a]"
                          title="Cambiar ícono"
                          value={subcategory.icon || "📦"}
                          onChange={(event) => {
                            const next = [...subcategories];
                            next[index] = { ...subcategory, icon: event.target.value };
                            updateSubcategories(next);
                          }}
                        >
                          {!EMOJIS.includes(subcategory.icon || "📦") && (
                            <option value={subcategory.icon}>{subcategory.icon}</option>
                          )}
                          {EMOJIS.map((emoji) => (
                            <option key={emoji} value={emoji}>{emoji}</option>
                          ))}
                        </select>
                        <Input
                          aria-label={`Nombre de subcategoría ${index + 1}`}
                          className="min-w-0 flex-1"
                          placeholder="Ej: Cables USB-C"
                          value={subcategory.name}
                          variant="bordered"
                          onChange={(event) => {
                            const next = [...subcategories];
                            next[index] = { ...subcategory, name: event.target.value };
                            updateSubcategories(next);
                          }}
                        />
                        <div className="flex shrink-0 flex-col">
                          <button
                            type="button"
                            aria-label={`Subir ${subcategory.name || "subcategoría"}`}
                            title="Subir"
                            disabled={index === 0}
                            className="flex size-5 items-center justify-center rounded text-black/55 transition-colors hover:bg-black/10 disabled:opacity-20 dark:text-white/55 dark:hover:bg-white/10"
                            onClick={() => moveSubcategory(index, index - 1)}
                          >
                            <ChevronUp size={15} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Bajar ${subcategory.name || "subcategoría"}`}
                            title="Bajar"
                            disabled={index === subcategories.length - 1}
                            className="flex size-5 items-center justify-center rounded text-black/55 transition-colors hover:bg-black/10 disabled:opacity-20 dark:text-white/55 dark:hover:bg-white/10"
                            onClick={() => moveSubcategory(index, index + 1)}
                          >
                            <ChevronDown size={15} />
                          </button>
                        </div>
                        <button
                          type="button"
                          aria-label={`Eliminar ${subcategory.name || "subcategoría"}`}
                          title="Eliminar subcategoría"
                          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-danger transition-colors hover:bg-danger/10"
                          onClick={() => updateSubcategories(
                            subcategories.filter((_, subcategoryIndex) => subcategoryIndex !== index),
                          )}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Guardar ────────────────────────────────────────────── */}
              <Button
                className="font-bold h-12 w-full"
                color="primary"
                isDisabled={!categoryName.trim()}
                isLoading={isSubmitting}
                onClick={() => handleSaveCategory(localIcon)}
              >
                {editingCategory?.id ? "Guardar Cambios" : "Crear Categoría"}
              </Button>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
