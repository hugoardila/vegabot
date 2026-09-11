import React, { useEffect, useMemo, useState } from "react";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { CheckCircle2, Download, LoaderCircle, Smartphone, Wifi, WifiOff } from "lucide-react";
import { canInstallStorePwa, getOfflineCatalogUpdatedAt, promptInstallStorePwa, updateOfflineCatalog } from "../../../pwa";

interface PwaCatalogModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const isAppleMobile = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export const PwaCatalogModal: React.FC<PwaCatalogModalProps> = ({ isOpen, onOpenChange }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [canInstall, setCanInstall] = useState(canInstallStorePwa());
  const [updatedAt, setUpdatedAt] = useState(getOfflineCatalogUpdatedAt());
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState("");
  const appleMobile = useMemo(isAppleMobile, []);

  useEffect(() => {
    const updateConnectivity = () => setIsOnline(navigator.onLine);
    const updateInstallAvailability = () => setCanInstall(canInstallStorePwa());
    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);
    window.addEventListener("vega-pwa-install-available", updateInstallAvailability);
    window.addEventListener("vega-pwa-installed", updateInstallAvailability);
    return () => {
      window.removeEventListener("online", updateConnectivity);
      window.removeEventListener("offline", updateConnectivity);
      window.removeEventListener("vega-pwa-install-available", updateInstallAvailability);
      window.removeEventListener("vega-pwa-installed", updateInstallAvailability);
    };
  }, []);

  const handleInstall = async () => {
    const installed = await promptInstallStorePwa();
    setCanInstall(canInstallStorePwa());
    if (installed) setMessage("La app se instalo en este dispositivo.");
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    setMessage("");
    try {
      const result = await updateOfflineCatalog();
      const now = new Date().toISOString();
      setUpdatedAt(now);
      setMessage(`Catalogo actualizado: ${result.products} productos y ${result.images} imagenes disponibles sin conexion.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible actualizar el catalogo.");
    } finally {
      setIsUpdating(false);
    }
  };

  const formattedUpdatedAt = updatedAt
    ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(updatedAt))
    : "Aun no se ha descargado";

  return (
    <Modal isOpen={isOpen} placement="center" scrollBehavior="inside" size="lg" onOpenChange={onOpenChange}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-3 border-b border-black/10 dark:border-white/10">
              <span className="flex size-10 items-center justify-center rounded-lg bg-[#0866D9]/10 text-[#0866D9]">
                <Smartphone size={21} />
              </span>
              <span>
                <span className="block text-base font-black">App para vendedores</span>
                <span className="mt-0.5 block text-xs font-medium text-black/50 dark:text-white/50">Catalogo disponible aun sin internet</span>
              </span>
            </ModalHeader>
            <ModalBody className="gap-4 py-5">
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold ${isOnline ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-800 dark:text-amber-200"}`}>
                {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
                {isOnline ? "Con conexion: puedes actualizar el catalogo." : "Sin conexion: se usara la ultima copia descargada."}
              </div>

              <div className="rounded-lg border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-sm font-black">Ultima actualizacion</p>
                <p className="mt-1 text-sm text-black/60 dark:text-white/60">{formattedUpdatedAt}</p>
                <p className="mt-3 text-xs leading-5 text-black/55 dark:text-white/55">
                  La descarga guarda productos, categorias, precios, existencias e imagenes en este dispositivo. El stock y los pagos se validan al recuperar conexion.
                </p>
              </div>

              {appleMobile && !canInstall && (
                <div className="rounded-lg border border-[#0866D9]/20 bg-[#0866D9]/5 p-3 text-sm leading-6 text-black/70 dark:text-white/70">
                  En iPhone o iPad: abre el menu Compartir de Safari y elige <strong>Anadir a pantalla de inicio</strong>.
                </div>
              )}

              {message && (
                <div className="flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/[0.06] px-3 py-3 text-sm font-medium text-black/70 dark:text-white/80">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-primary" size={18} />
                  {message}
                </div>
              )}
            </ModalBody>
            <ModalFooter className="border-t border-black/10 dark:border-white/10">
              <button className="h-10 rounded-lg px-4 text-sm font-bold text-black/60 transition-colors hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10" type="button" onClick={onClose}>
                Cerrar
              </button>
              {canInstall && (
                <button className="flex h-10 items-center gap-2 rounded-lg bg-[#0866D9] px-4 text-sm font-black text-white shadow-sm transition hover:brightness-105" type="button" onClick={handleInstall}>
                  <Smartphone size={16} />
                  Instalar app
                </button>
              )}
              <button className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-black text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45" disabled={!isOnline || isUpdating} type="button" onClick={handleUpdate}>
                {isUpdating ? <LoaderCircle className="animate-spin" size={16} /> : <Download size={16} />}
                Actualizar catalogo
              </button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
