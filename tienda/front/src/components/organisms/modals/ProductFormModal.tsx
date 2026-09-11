import React, { useState, useEffect, useMemo } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Image } from "@heroui/image";
import { Switch } from "@heroui/switch";
import { TrashIcon, SearchIcon } from "../../atoms/icons";
import { Product, Category } from "../../../types";
import { adminService } from "../../../services/admin";
import { formatPrice, parsePrice } from "../../../utils/format";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
const API_BASE = API_URL.replace("/api", "");

const releaseActiveFocus = () => {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
};

interface ProductFormModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  editingProduct: Partial<Product> | null;
  setEditingProduct: (p: Partial<Product> | null) => void;
  categoriesData: Category[];
  isSubmitting: boolean;
  handleSaveProduct: () => void;
  token: string | null;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onOpenChange,
  editingProduct,
  setEditingProduct,
  categoriesData,
  isSubmitting,
  handleSaveProduct,
  token,
}) => {
  // URL → media ID map so we can delete by ID immediately
  const [mediaMap, setMediaMap] = useState<Record<string, string>>({});
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);

  // Category modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");

  // Uploads gallery modal state
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [galleryFiles, setGalleryFiles] = useState<Array<{name: string; url: string; type: string}>>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categoriesData;
    return categoriesData.filter(cat =>
      cat.name.toLowerCase().includes(categorySearch.toLowerCase())
    );
  }, [categoriesData, categorySearch]);

  const selectedCategory = categoriesData.find(
    cat => cat.id.toString() === editingProduct?.category_id
  );
  const availableSubcategories = selectedCategory?.subcategories || [];

  // Fetch media objects (with IDs) whenever we open an existing product
  useEffect(() => {
    if (!isOpen || !editingProduct?.id || !token) {
      setMediaMap({});
      return;
    }
    fetch(`${API_URL}/products/${encodeURIComponent(editingProduct.id)}/media`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text();
          throw new Error(`Error fetching media: ${r.status} ${text}`);
        }
        return r.json();
      })
      .then((media: Array<{ id: string; url: string }>) => {
        if (!Array.isArray(media)) {
          throw new Error("Invalid media response");
        }
        const map: Record<string, string> = {};
        media.forEach((m) => {
          map[m.url] = m.id;
        });
        setMediaMap(map);
      })
      .catch((error) => {
        console.error(error);
        setMediaMap({});
      });
  }, [isOpen, editingProduct?.id, token]);

  const handleDeleteImage = async (imgUrl: string, index: number) => {
    if (!editingProduct) return;

    // Remove from local state immediately
    const newImages = [...(editingProduct.images || [])];
    newImages.splice(index, 1);
    setEditingProduct({ ...editingProduct, images: newImages });

    // If this image exists in the DB, delete it via the API
    const mediaId = mediaMap[imgUrl];
    if (mediaId && token) {
      setDeletingUrl(imgUrl);
      try {
        await fetch(`${API_URL.replace("/api", "")}/api/media/${mediaId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        // Remove from the map too
        setMediaMap((prev) => {
          const next = { ...prev };
          delete next[imgUrl];
          return next;
        });
      } catch (e) {
        console.error("Error eliminando imagen:", e);
      } finally {
        setDeletingUrl(null);
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) releaseActiveFocus();
        onOpenChange(open);
      }}
      backdrop="opaque"
      className="dark:bg-[#0a0a0a] bg-white border border-white/10"
      size="lg"
      scrollBehavior="inside"
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="text-black dark:text-white">
              {editingProduct?.id ? "Editar Producto" : "Nuevo Producto"}
            </ModalHeader>

            <ModalBody className="pb-8 flex flex-col gap-4">
              {/* Nombre */}
              <Input
                label="Nombre comercial en tienda"
                placeholder="Ej: Diademas Ultra Pro"
                variant="bordered"
                value={editingProduct?.name || ""}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, name: e.target.value })
                }
              />

              {editingProduct?.saint_name && (
                <div className="rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-[10px] font-bold uppercase text-black/40 dark:text-white/40">Referencia SAINT</p>
                  <p className="text-xs font-semibold text-black/70 dark:text-white/70">{editingProduct.saint_name}</p>
                </div>
              )}

              {/* Descripción */}
              <Textarea
                label="Descripción"
                placeholder="Describe el producto aquí..."
                variant="bordered"
                minRows={3}
                value={editingProduct?.description || ""}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, description: e.target.value })
                }
              />

              {/* Precio + Stock */}
              <div className="flex gap-4">
                <Input
                  label="Precio"
                  placeholder="0"
                  variant="bordered"
                  startContent={
                    <div className="text-xs text-black/40 dark:text-white/40">
                      $
                    </div>
                  }
                  value={formatPrice(editingProduct?.price_2 ?? editingProduct?.price ?? 0)}
                  onChange={(e) => {
                    const price = parsePrice(e.target.value);
                    setEditingProduct({ ...editingProduct, price, price_2: price });
                  }}
                />
                <Input
                  type="number"
                  label="Stock"
                  placeholder="0"
                  variant="bordered"
                  value={editingProduct?.stock?.toString() || "0"}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      stock: parseInt(e.target.value, 10) || 0,
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex min-h-20 items-center rounded-xl border border-black/10 px-4 py-3 sm:col-span-2 dark:border-white/10">
                  <Switch
                    color="success"
                    isDisabled={Number(editingProduct?.stock || 0) <= 0}
                    isSelected={Boolean(editingProduct?.enabled) && Number(editingProduct?.stock || 0) > 0}
                    onValueChange={(isSelected) =>
                      setEditingProduct({ ...editingProduct, enabled: isSelected })
                    }
                  >
                    Producto habilitado en la tienda
                  </Switch>
                </div>

                <div className="flex min-h-20 items-center rounded-xl border border-black/10 px-4 py-3 dark:border-white/10">
                  <Switch
                    color="success"
                    isSelected={Boolean(editingProduct?.free_shipping)}
                    onValueChange={(isSelected) =>
                      setEditingProduct({ ...editingProduct, free_shipping: isSelected })
                    }
                  >
                    Marcar envio gratis
                  </Switch>
                </div>

                <div className="flex min-h-28 flex-col items-stretch gap-3 rounded-xl border border-black/10 px-4 py-3 dark:border-white/10">
                  <Switch
                    className="w-full"
                    color="danger"
                    isSelected={Boolean(editingProduct?.promotion_enabled)}
                    onValueChange={(isSelected) =>
                      setEditingProduct({
                        ...editingProduct,
                        promotion_enabled: isSelected,
                        promotion_percent: isSelected
                          ? Math.max(Number(editingProduct?.promotion_percent || 0), 1)
                          : 0,
                      })
                    }
                  >
                    Promocion
                  </Switch>
                  <Input
                    className="w-full min-w-0"
                    classNames={{
                      input: "text-base font-bold text-black tabular-nums dark:text-white",
                      inputWrapper: "h-12 bg-white dark:bg-black/20",
                      label: "text-xs",
                    }}
                    endContent={<span className="shrink-0 text-sm font-bold text-black/55 dark:text-white/55">%</span>}
                    isDisabled={!editingProduct?.promotion_enabled}
                    label="Porcentaje de descuento"
                    max={99}
                    min={1}
                    placeholder="Ejemplo: 15"
                    size="md"
                    type="number"
                    value={String(editingProduct?.promotion_percent || 0)}
                    variant="bordered"
                    onChange={(event) => {
                      const percent = Math.min(Math.max(Number(event.target.value || 0), 0), 99);
                      setEditingProduct({ ...editingProduct, promotion_percent: percent });
                    }}
                  />
                </div>
              </div>

              {/* Categoría - Modal con buscador */}
              <div className="flex flex-col gap-2">
                <label className="text-sm text-black/70 dark:text-white/70">Categoría</label>
                <button
                  type="button"
                  onClick={() => {
                    releaseActiveFocus();
                    setCategorySearch("");
                    setIsCategoryModalOpen(true);
                  }}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#0a0a0a] hover:border-primary/50 transition-colors text-left"
                >
                  <span className={selectedCategory ? "text-black dark:text-white" : "text-black/40 dark:text-white/40"}>
                    {selectedCategory?.name || "Selecciona una categoría"}
                  </span>
                  <svg className="w-5 h-5 text-black/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {selectedCategory && (
                <div className="flex flex-col gap-2">
                  <label
                    className="text-sm text-black/70 dark:text-white/70"
                    htmlFor="product-subcategory"
                  >
                    Subcategoría visual
                  </label>
                  <select
                    id="product-subcategory"
                    className="h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-sm text-black outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-white/10 dark:bg-[#0a0a0a] dark:text-white"
                    value={editingProduct?.subcategory_id || ""}
                    onChange={(event) => setEditingProduct({
                      ...editingProduct,
                      subcategory_id: event.target.value,
                    })}
                  >
                    <option value="">Sin subcategoría</option>
                    {availableSubcategories.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>
                        {subcategory.icon || "📦"} {subcategory.name}
                      </option>
                    ))}
                  </select>
                  {availableSubcategories.length === 0 && (
                    <p className="text-xs text-black/45 dark:text-white/45">
                      Crea subcategorías desde la edición de la categoría.
                    </p>
                  )}
                </div>
              )}

              {/* Modal de selección de categoría */}
              <Modal
                isOpen={isCategoryModalOpen}
                onOpenChange={(open) => {
                  if (!open) releaseActiveFocus();
                  setIsCategoryModalOpen(open);
                }}
                backdrop="opaque"
                size="sm"
                className="dark:bg-[#0a0a0a] bg-white"
              >
                <ModalContent>
                  {() => (
                    <>
                      <ModalHeader className="border-b border-black/5 dark:border-white/5">
                        <span className="text-lg font-bold">Seleccionar Categoría</span>
                      </ModalHeader>
                      <ModalBody className="py-4">
                        {/* Buscador */}
                        <div className="relative mb-4">
                          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-black/40" />
                          <Input
                            placeholder="Buscar categoría..."
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                            className="pl-10"
                            variant="bordered"
                            autoFocus
                          />
                        </div>

                        {/* Lista de categorías */}
                        <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
                          {filteredCategories.length === 0 ? (
                            <p className="text-center text-black/40 dark:text-white/40 py-4 text-sm">
                              No se encontraron categorías
                            </p>
                          ) : (
                            filteredCategories.map((cat) => {
                              const isSelected = cat.id.toString() === editingProduct?.category_id;
                              return (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => {
                                    setEditingProduct({
                                      ...editingProduct,
                                      category_id: cat.id.toString(),
                                      subcategory_id: "",
                                    });
                                    releaseActiveFocus();
                                    setIsCategoryModalOpen(false);
                                  }}
                                  className={`flex items-center justify-between w-full px-4 py-3 rounded-xl text-left transition-all ${
                                    isSelected
                                      ? "bg-primary/10 border border-primary/20 text-primary"
                                      : "hover:bg-black/5 dark:hover:bg-white/5 text-black dark:text-white"
                                  }`}
                                >
                                  <span className="font-medium">{cat.name}</span>
                                  {isSelected && (
                                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </ModalBody>
                      <ModalFooter className="border-t border-black/5 dark:border-white/5">
                        <Button
                          variant="flat"
                          className="w-full font-bold"
                          onClick={() => {
                            releaseActiveFocus();
                            setIsCategoryModalOpen(false);
                          }}
                        >
                          Cancelar
                        </Button>
                      </ModalFooter>
                    </>
                  )}
                </ModalContent>
              </Modal>

              {/* Gallery Modal - Ver todas las imágenes */}
              <Modal
                isOpen={isGalleryModalOpen}
                onOpenChange={(open) => {
                  if (!open) releaseActiveFocus();
                  setIsGalleryModalOpen(open);
                }}
                backdrop="opaque"
                size="lg"
                scrollBehavior="inside"
                className="dark:bg-[#0a0a0a] bg-white"
              >
                <ModalContent>
                  {() => (
                    <>
                      <ModalHeader className="border-b border-black/5 dark:border-white/5">
                        <span className="text-lg font-bold">📁 Galería de Imágenes</span>
                        <span className="text-sm text-black/50 dark:text-white/50 ml-2">
                          ({galleryFiles.length} archivos)
                        </span>
                      </ModalHeader>
                      <ModalBody className="py-4">
                        {galleryLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          </div>
                        ) : galleryFiles.length === 0 ? (
                          <div className="text-center py-12 text-black/50 dark:text-white/50">
                            <p className="text-4xl mb-2">📭</p>
                            <p>No hay imágenes en la carpeta</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                            {galleryFiles.map((file) => (
                              <button
                                key={file.url}
                                type="button"
                                onClick={() => {
                                  const currentProduct = editingProduct || {
                                    name: "",
                                    description: "",
                                    price: 0,
                                    stock: 0,
                                    category_id: "",
                                    images: [],
                                  };
                                  if (!currentProduct.images?.includes(file.url)) {
                                    setEditingProduct({
                                      ...currentProduct,
                                      images: [...(currentProduct.images || []), file.url],
                                    });
                                  }
                                  releaseActiveFocus();
                                  setIsGalleryModalOpen(false);
                                }}
                                className="relative aspect-square rounded-xl overflow-hidden border border-black/10 dark:border-white/10 hover:ring-2 hover:ring-primary transition-all group"
                              >
                                {file.type === "video" ? (
                                  <video
                                    src={API_BASE + file.url}
                                    className="w-full h-full object-cover"
                                    preload="metadata"
                                  />
                                ) : (
                                  <img
                                    src={API_BASE + file.url}
                                    alt={file.name}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                  <span className="opacity-0 group-hover:opacity-100 text-white font-bold text-xs bg-primary/80 px-2 py-1 rounded">
                                    + Agregar
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </ModalBody>
                      <ModalFooter className="border-t border-black/5 dark:border-white/5">
                        <Button
                          variant="flat"
                          className="w-full font-bold"
                          onClick={() => {
                            releaseActiveFocus();
                            setIsGalleryModalOpen(false);
                          }}
                        >
                          Cerrar
                        </Button>
                      </ModalFooter>
                    </>
                  )}
                </ModalContent>
              </Modal>

              {/* Imágenes */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-black/70 dark:text-white/70">
                    Imágenes del Producto
                  </p>
                  <Button
                    size="sm"
                    variant="flat"
                    className="bg-primary/10 text-primary font-bold text-xs"
                    onClick={async () => {
                      if (!token) return;
                      releaseActiveFocus();
                      setGalleryLoading(true);
                      setIsGalleryModalOpen(true);
                      try {
                        const res = await adminService.listUploadProductos(token);
                        setGalleryFiles(res.files || []);
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setGalleryLoading(false);
                      }
                    }}
                  >
                    📁 Ver todas
                  </Button>
                </div>

                <div className="flex flex-wrap gap-3">
                  {(editingProduct?.images || [])
                    .filter((url) => url.trim() !== "")
                    .map((imgUrl, i) => {
                      const src = imgUrl.startsWith("/")
                        ? API_BASE + imgUrl
                        : imgUrl;
                      const isDeleting = deletingUrl === imgUrl;

                      return (
                        <div
                          key={imgUrl + i}
                          className={`relative w-20 h-20 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 transition-opacity ${
                            isDeleting ? "opacity-40" : "opacity-100"
                          }`}
                        >
                          {src.match(/\.(mp4|webm|mov)$/i) ? (
                            <video
                              src={src}
                              className="w-full h-full object-cover"
                              autoPlay
                              muted
                              loop
                              playsInline
                            />
                          ) : (
                            <Image
                              src={src}
                              className="w-full h-full object-cover"
                              alt={`media-${i}`}
                            />
                          )}

                          {/* Botón eliminar — siempre visible */}
                          <button
                            disabled={isDeleting}
                            title="Eliminar imagen"
                            className="absolute top-1 right-1 z-10 bg-danger text-white rounded-full p-1 shadow-lg active:scale-90 transition-transform disabled:opacity-50"
                            onClick={() => handleDeleteImage(imgUrl, i)}
                          >
                            <TrashIcon size={12} />
                          </button>
                        </div>
                      );
                    })}

                  {/* Botón subir nueva imagen */}
                  <label className="w-20 h-20 rounded-xl border-2 border-dashed border-black/20 dark:border-white/20 flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !token) return;
                        try {
                          const res = await adminService.uploadImage(
                            file,
                            token,
                          );
                          const currentProduct = editingProduct || {
                            name: "",
                            description: "",
                            price: 0,
                            stock: 0,
                            category_id: "",
                            images: [],
                          };
                          setEditingProduct({
                            ...currentProduct,
                            images: [...(currentProduct.images || []), res.url],
                          });
                        } catch (err) {
                          console.error(err);
                          alert("Error subiendo el archivo");
                        }
                      }}
                    />
                    <span className="text-2xl leading-none">+</span>
                    <span className="text-[10px] mt-1 text-black/40 dark:text-white/40">
                      Subir
                    </span>
                  </label>
                </div>

                {(editingProduct?.images || []).filter((u) => u.trim() !== "")
                  .length === 0 && (
                  <p className="text-[11px] text-black/30 dark:text-white/30 mt-1">
                    Sin imágenes. Toca + para agregar una.
                  </p>
                )}
              </div>

            </ModalBody>

            <ModalFooter className="border-t border-black/5 dark:border-white/5 px-8 py-6">
              <Button
                color="primary"
                className="font-bold h-12 w-full text-base"
                isLoading={isSubmitting}
                onClick={handleSaveProduct}
                isDisabled={!editingProduct?.name?.trim()}
              >
                {editingProduct?.id ? "Guardar Cambios" : "Crear Producto"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
