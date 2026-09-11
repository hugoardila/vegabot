import React, { useEffect, useState } from "react";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { CheckCircle2, LoaderCircle, Search, UserRound } from "lucide-react";
import { authService, SaintCustomerMatch } from "../../../services/auth";
import { useAuth } from "../../../context/AuthContext";
import { saveCheckoutProfile } from "../../../utils/checkoutProfile";

interface CustomerZoneModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

type CustomerForm = Pick<SaintCustomerMatch, "full_name" | "id_number" | "phone" | "email">;

const emptyForm: CustomerForm = {
  full_name: "",
  id_number: "",
  phone: "",
  email: "",
};

export const CustomerZoneModal: React.FC<CustomerZoneModalProps> = ({ isOpen, onOpenChange }) => {
  const { login } = useAuth();
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [matches, setMatches] = useState<SaintCustomerMatch[]>([]);
  const [selected, setSelected] = useState<SaintCustomerMatch | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (selected || searchTerm.trim().length < 3) {
      setMatches([]);
      if (searchTerm.trim().length < 3) setHasSearched(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      setError("");
      try {
        const items = await authService.searchSaintCustomers(searchTerm.trim());
        if (active) {
          setMatches(items);
          setHasSearched(true);
        }
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "No fue posible consultar SAINT");
      } finally {
        if (active) setIsSearching(false);
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchTerm, selected]);

  const updateField = (field: keyof CustomerForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "email" && selected) {
      setError("");
      return;
    }
    setSelected(null);
    setSearchTerm(value);
    setHasSearched(false);
    setError("");
  };

  const selectCustomer = (customer: SaintCustomerMatch) => {
    setSelected(customer);
    setForm({
      full_name: customer.full_name || "",
      id_number: customer.id_number || "",
      phone: customer.phone || "",
      email: customer.email || "",
    });
    setSearchTerm("");
    setMatches([]);
    setHasSearched(false);
    setError("");
  };

  const reset = () => {
    setForm(emptyForm);
    setSearchTerm("");
    setMatches([]);
    setSelected(null);
    setHasSearched(false);
    setError("");
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleSession = async () => {
    if (!selected) return;
    const email = form.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Ingresa un correo electrónico válido. Es necesario para enviar comprobantes y procesar pagos con Wompi.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const response = await authService.loginWithSaintCustomer(selected.code, email);
      saveCheckoutProfile({
        fullName: response.user.full_name || form.full_name,
        phone: response.user.phone || form.phone,
        idNumber: response.user.id_number || form.id_number,
        email: response.user.email || form.email,
      });
      login(response, "/");
      handleOpenChange(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible iniciar sesión");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      placement="center"
      scrollBehavior="inside"
      size="lg"
      classNames={{ base: "mx-2 max-h-[90dvh] sm:mx-0", body: "overflow-y-auto" }}
      onOpenChange={handleOpenChange}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-3 border-b border-black/10 dark:border-white/10">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserRound size={21} />
              </span>
              <span>
                <span className="block text-base font-black">Zona Clientes</span>
                <span className="mt-0.5 block text-xs font-medium text-black/50 dark:text-white/50">Encuentra tus datos registrados en SAINT</span>
              </span>
            </ModalHeader>
            <ModalBody className="gap-4 py-5">
              <p className="text-sm leading-6 text-black/60 dark:text-white/60">
                Escribe tu nombre, cédula, teléfono o correo. Selecciona tu registro para completar tus datos e ingresar.
              </p>

              {(isSearching || matches.length > 0 || hasSearched) && (
                <div className="overflow-hidden rounded-lg border border-primary/15 bg-primary/[0.03]">
                  <div className="flex items-center gap-2 border-b border-primary/10 px-3 py-2 text-xs font-bold text-primary">
                    {isSearching ? <LoaderCircle className="animate-spin" size={14} /> : <Search size={14} />}
                    {isSearching ? "Buscando en clientes SAINT..." : matches.length ? "Selecciona tu registro" : "Sin coincidencias"}
                  </div>
                  {!isSearching && matches.map((customer) => (
                    <button
                      key={customer.code}
                      className="flex w-full items-center justify-between gap-3 border-b border-primary/10 px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-primary/10"
                      type="button"
                      onClick={() => selectCustomer(customer)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{customer.full_name}</span>
                        <span className="mt-0.5 block truncate text-xs text-black/55 dark:text-white/55">{customer.id_number || customer.phone || customer.email || customer.code}</span>
                      </span>
                      <span className="shrink-0 rounded-md bg-white px-2 py-1 text-[10px] font-black text-primary shadow-sm dark:bg-white/10">{customer.code}</span>
                    </button>
                  ))}
                  {!isSearching && !matches.length && (
                    <p className="px-3 py-2.5 text-xs font-medium text-black/55 dark:text-white/55">Prueba con nombre completo, cédula, teléfono o correo.</p>
                  )}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-bold text-black/70 dark:text-white/70">
                  Nombre completo
                  <input
                    className="h-11 rounded-lg border border-black/10 bg-white px-3 text-sm font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-white/15 dark:bg-white/5"
                    value={form.full_name}
                    onChange={(event) => updateField("full_name", event.target.value)}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-black/70 dark:text-white/70">
                  Cédula o NIT
                  <input
                    className="h-11 rounded-lg border border-black/10 bg-white px-3 text-sm font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-white/15 dark:bg-white/5"
                    inputMode="numeric"
                    value={form.id_number}
                    onChange={(event) => updateField("id_number", event.target.value)}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-black/70 dark:text-white/70">
                  Teléfono
                  <input
                    className="h-11 rounded-lg border border-black/10 bg-white px-3 text-sm font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-white/15 dark:bg-white/5"
                    inputMode="tel"
                    type="tel"
                    value={form.phone}
                    onChange={(event) => updateField("phone", event.target.value)}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-bold text-black/70 dark:text-white/70">
                  Correo electrónico
                  <input
                    className="h-11 rounded-lg border border-black/10 bg-white px-3 text-sm font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-white/15 dark:bg-white/5"
                    inputMode="email"
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField("email", event.target.value)}
                  />
                  {selected && !selected.email && <span className="font-medium text-amber-700 dark:text-amber-300">Requerido para pagos con Wompi.</span>}
                </label>
              </div>

              {selected && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 size={18} />
                  Cliente seleccionado: {selected.code}
                </div>
              )}

              {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>}
            </ModalBody>
            <ModalFooter className="border-t border-black/10 dark:border-white/10">
              <button className="h-10 rounded-lg px-4 text-sm font-bold text-black/60 transition-colors hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10" type="button" onClick={onClose}>
                Cancelar
              </button>
              <button
                className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-black text-white shadow-sm transition-transform hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={!selected || isSubmitting}
                type="button"
                onClick={handleSession}
              >
                {isSubmitting && <LoaderCircle className="animate-spin" size={16} />}
                Iniciar sesión
              </button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
