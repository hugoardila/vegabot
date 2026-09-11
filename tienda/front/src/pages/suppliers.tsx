import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Pagination } from "@heroui/pagination";
import { Spinner } from "@heroui/spinner";
import { Switch } from "@heroui/switch";
import { addToast } from "@heroui/toast";
import {
  CheckCircle2,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  Store,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePagination } from "../hooks/usePagination";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
const API_BASE = API_URL.replace("/api", "");

interface Distributor {
  id: string;
  name: string;
  contact_name: string;
  address: string;
  city: string;
  phone: string;
  image_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DistributorForm {
  name: string;
  contact_name: string;
  address: string;
  city: string;
  phone: string;
  image_url: string;
  is_active: boolean;
}

const emptyForm: DistributorForm = {
  name: "",
  contact_name: "",
  address: "",
  city: "",
  phone: "",
  image_url: "",
  is_active: true,
};

const resolveImageUrl = (url: string) => {
  if (!url) return "";
  return url.startsWith("http") ? url : API_BASE + url;
};

const getWhatsappUrl = (phone: string, name: string) => {
  const digits = phone.replace(/[^\d]/g, "");
  const message = encodeURIComponent("Hola, vi su punto autorizado " + name + " en Vega Importadora.");
  return "https://wa.me/" + digits + "?text=" + message;
};

const getMapsUrl = (distributor: Distributor) => {
  const query = encodeURIComponent([distributor.address, distributor.city].filter(Boolean).join(", "));
  return "https://www.google.com/maps/search/?api=1&query=" + query;
};

export const SuppliersView: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Distributor | null>(null);
  const [deleting, setDeleting] = useState<Distributor | null>(null);
  const [form, setForm] = useState<DistributorForm>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  const fetchDistributors = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const endpoint = isAdmin ? "/suppliers" : "/distributors";
      const response = await fetch(API_URL + endpoint, {
        headers: isAdmin && token ? { Authorization: "Bearer " + token } : {},
      });
      if (!response.ok) throw new Error("No fue posible cargar los distribuidores");
      setDistributors(await response.json());
    } catch (error) {
      console.error(error);
      setDistributors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDistributors();
  }, [isAdmin]);

  useEffect(() => () => {
    if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const cities = useMemo(
    () => [...new Set(distributors.map((item) => item.city).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    [distributors],
  );

  const filteredDistributors = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return distributors.filter((item) => {
      if (selectedCity && item.city !== selectedCity) return false;
      if (!normalizedSearch) return true;
      return [item.name, item.city, item.address, item.contact_name, item.phone]
        .some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
    });
  }, [distributors, search, selectedCity]);

  const {
    currentPage,
    setCurrentPage,
    pages,
    paginatedItems,
  } = usePagination(filteredDistributors, 12, [search, selectedCity, distributors]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview("");
    setIsFormOpen(true);
  };

  const openEdit = (distributor: Distributor) => {
    setEditing(distributor);
    setForm({
      name: distributor.name,
      contact_name: distributor.contact_name,
      address: distributor.address,
      city: distributor.city,
      phone: distributor.phone,
      image_url: distributor.image_url,
      is_active: distributor.is_active,
    });
    setImageFile(null);
    setImagePreview(resolveImageUrl(distributor.image_url));
    setIsFormOpen(true);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      addToast({ title: "Selecciona un archivo de imagen", color: "danger" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      addToast({ title: "La imagen no debe superar 10 MB", color: "danger" });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (token: string) => {
    if (!imageFile) return form.image_url;
    const body = new FormData();
    body.append("image", imageFile);
    const response = await fetch(API_URL + "/upload_distributor", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "No fue posible cargar la imagen");
    return String(data.url || "");
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.city.trim() || !form.address.trim() || !form.phone.trim()) {
      addToast({ title: "Completa nombre, ciudad, dirección y contacto", color: "danger" });
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) return;
    setSaving(true);
    try {
      const imageUrl = await uploadImage(token);
      const response = await fetch(
        API_URL + "/distributors" + (editing ? "/" + encodeURIComponent(editing.id) : ""),
        {
          method: editing ? "PUT" : "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...form, image_url: imageUrl }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "No fue posible guardar el distribuidor");
      addToast({
        title: editing ? "Distribuidor actualizado" : "Distribuidor creado",
        color: "success",
      });
      setIsFormOpen(false);
      await fetchDistributors();
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "Error al guardar", color: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(API_URL + "/distributors/" + encodeURIComponent(deleting.id), {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "No fue posible eliminar el distribuidor");
      }
      addToast({ title: "Distribuidor eliminado", color: "success" });
      setDeleting(null);
      await fetchDistributors();
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "Error al eliminar", color: "danger" });
    }
  };

  return (
    <div className="w-full">
      <header className="mb-6 flex flex-col gap-4 border-b border-black/5 pb-5 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-black text-success">
            <CheckCircle2 size={14} />
            Red autorizada
          </div>
          <h1 className="text-2xl font-black text-black dark:text-white lg:text-3xl">
            Distribuidores autorizados
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-black/55 dark:text-white/55">
            Encuentra puntos autorizados para comprar productos Vega Importadora en otras ciudades.
            <span className="mt-3 block w-fit rounded-md border-l-4 border-danger bg-danger/10 px-3 py-2 text-xs font-black text-danger dark:bg-danger/15 dark:text-red-300">
              Nota: los precios pueden variar dependiendo de la ciudad y la tienda.
            </span>
          </p>
        </div>
        {isAdmin && (
          <Button color="primary" startContent={<Plus size={17} />} onPress={openCreate}>
            Nuevo distribuidor
          </Button>
        )}
      </header>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <Input
          startContent={<Search className="text-black/35 dark:text-white/35" size={17} />}
          placeholder="Buscar por nombre, ciudad o dirección"
          value={search}
          variant="bordered"
          onValueChange={setSearch}
        />
        <select
          aria-label="Filtrar distribuidores por ciudad"
          className="h-12 rounded-lg border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-primary dark:border-white/10 dark:bg-[#121212] dark:text-white"
          value={selectedCity}
          onChange={(event) => setSelectedCity(event.target.value)}
        >
          <option value="">Todas las ciudades</option>
          {cities.map((city) => <option key={city} value={city}>{city}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center">
          <Spinner color="primary" label="Cargando distribuidores..." />
        </div>
      ) : paginatedItems.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center text-center">
          <Store className="mb-3 text-black/20 dark:text-white/20" size={48} />
          <p className="font-bold">No encontramos distribuidores</p>
          <p className="mt-1 text-sm text-black/50 dark:text-white/50">Prueba con otra ciudad o búsqueda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paginatedItems.map((distributor) => (
            <article
              className="group overflow-hidden rounded-lg border border-black/5 bg-white shadow-sm transition hover:border-primary/20 hover:shadow-md dark:border-white/10 dark:bg-white/5"
              key={distributor.id}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-black/5 dark:bg-white/5">
                {distributor.image_url ? (
                  <img
                    alt={distributor.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    src={resolveImageUrl(distributor.image_url)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-primary/30">
                    <Store size={64} />
                  </div>
                )}
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-[10px] font-black text-white shadow">
                  <CheckCircle2 size={12} />
                  Autorizado
                </span>
                {isAdmin && !distributor.is_active && (
                  <span className="absolute right-2 top-2 rounded-full bg-danger px-2.5 py-1 text-[10px] font-black text-white">
                    Inactivo
                  </span>
                )}
                {isAdmin && (
                  <div className="absolute bottom-2 right-2 flex gap-1.5">
                    <Button
                      isIconOnly
                      aria-label={"Editar " + distributor.name}
                      className="bg-white text-primary shadow dark:bg-[#151515]"
                      size="sm"
                      onPress={() => openEdit(distributor)}
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      isIconOnly
                      aria-label={"Eliminar " + distributor.name}
                      className="bg-white text-danger shadow dark:bg-[#151515]"
                      size="sm"
                      onPress={() => setDeleting(distributor)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 p-4">
                <div>
                  <h2 className="line-clamp-2 text-base font-black text-black dark:text-white">
                    {distributor.name}
                  </h2>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-primary">
                    <MapPin size={14} />
                    {distributor.city || "Ciudad por confirmar"}
                  </p>
                </div>

                <div className="space-y-2 text-xs text-black/60 dark:text-white/60">
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 shrink-0" size={14} />
                    <span>{distributor.address || "Dirección por confirmar"}</span>
                  </p>
                  {distributor.contact_name && (
                    <p className="flex items-center gap-2">
                      <UserRound className="shrink-0" size={14} />
                      <span>{distributor.contact_name}</span>
                    </p>
                  )}
                  <p className="flex items-center gap-2">
                    <Phone className="shrink-0" size={14} />
                    <span>{distributor.phone}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-black/5 pt-3 dark:border-white/10">
                  <Button
                    as="a"
                    className="bg-success/10 text-success"
                    href={getWhatsappUrl(distributor.phone, distributor.name)}
                    size="sm"
                    startContent={<MessageCircle size={15} />}
                    target="_blank"
                    variant="flat"
                  >
                    Contactar
                  </Button>
                  <Button
                    as="a"
                    href={getMapsUrl(distributor)}
                    size="sm"
                    startContent={<MapPin size={15} />}
                    target="_blank"
                    variant="flat"
                  >
                    Ubicación
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-8 flex justify-center">
          <Pagination
            isCompact
            showControls
            color="primary"
            page={currentPage}
            total={pages}
            onChange={setCurrentPage}
          />
        </div>
      )}

      <Modal
        backdrop="blur"
        isOpen={isFormOpen}
        scrollBehavior="inside"
        size="2xl"
        onOpenChange={setIsFormOpen}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="border-b border-black/5 dark:border-white/10">
                {editing ? "Editar distribuidor" : "Nuevo distribuidor autorizado"}
              </ModalHeader>
              <ModalBody className="gap-4 py-5">
                <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <div>
                    <button
                      className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-black/15 bg-black/[0.03] text-black/40 hover:border-primary/40 hover:text-primary dark:border-white/15 dark:bg-white/5 dark:text-white/40"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {imagePreview ? (
                        <img alt="Vista previa" className="h-full w-full object-cover" src={imagePreview} />
                      ) : (
                        <span className="flex flex-col items-center gap-2 text-xs font-bold">
                          <ImageIcon size={30} />
                          Cargar imagen
                        </span>
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      type="file"
                      onChange={handleImageChange}
                    />
                    <div className="mt-2 flex gap-2">
                      <Button
                        className="flex-1"
                        size="sm"
                        startContent={<Upload size={14} />}
                        variant="flat"
                        onPress={() => fileInputRef.current?.click()}
                      >
                        Imagen
                      </Button>
                      {imagePreview && (
                        <Button
                          isIconOnly
                          aria-label="Quitar imagen"
                          color="danger"
                          size="sm"
                          variant="flat"
                          onPress={() => {
                            setImageFile(null);
                            setImagePreview("");
                            setForm((current) => ({ ...current, image_url: "" }));
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <Input
                      isRequired
                      label="Nombre del punto"
                      placeholder="Ejemplo: Punto Autorizado Centro"
                      value={form.name}
                      variant="bordered"
                      onValueChange={(value) => setForm((current) => ({ ...current, name: value }))}
                    />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Input
                        isRequired
                        label="Ciudad"
                        value={form.city}
                        variant="bordered"
                        onValueChange={(value) => setForm((current) => ({ ...current, city: value }))}
                      />
                      <Input
                        isRequired
                        label="Teléfono o WhatsApp"
                        placeholder="+57..."
                        value={form.phone}
                        variant="bordered"
                        onValueChange={(value) => setForm((current) => ({ ...current, phone: value }))}
                      />
                    </div>
                    <Input
                      isRequired
                      label="Dirección"
                      value={form.address}
                      variant="bordered"
                      onValueChange={(value) => setForm((current) => ({ ...current, address: value }))}
                    />
                    <Input
                      label="Persona de contacto"
                      value={form.contact_name}
                      variant="bordered"
                      onValueChange={(value) => setForm((current) => ({ ...current, contact_name: value }))}
                    />
                    <div className="rounded-lg border border-black/10 px-3 py-2 dark:border-white/10">
                      <Switch
                        color="success"
                        isSelected={form.is_active}
                        onValueChange={(value) => setForm((current) => ({ ...current, is_active: value }))}
                      >
                        Mostrar como distribuidor autorizado
                      </Switch>
                    </div>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className="border-t border-black/5 dark:border-white/10">
                <Button variant="flat" onPress={onClose}>Cancelar</Button>
                <Button color="primary" isLoading={saving} onPress={handleSave}>
                  {editing ? "Guardar cambios" : "Crear distribuidor"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={Boolean(deleting)} size="sm" onOpenChange={(open) => !open && setDeleting(null)}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Eliminar distribuidor</ModalHeader>
              <ModalBody>
                <p className="text-sm text-black/65 dark:text-white/65">
                  Se eliminará <strong>{deleting?.name}</strong> y su imagen almacenada.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>Cancelar</Button>
                <Button color="danger" onPress={handleDelete}>Eliminar</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default SuppliersView;
