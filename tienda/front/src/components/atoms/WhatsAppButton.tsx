import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, ChevronRight, Headphones } from "lucide-react";
import { WhatsAppIcon } from "./icons";

interface WhatsAppButtonProps {
  phoneNumber?: string;
  salesPhoneNumber?: string;
  salesMessage?: string;
  supportMessage?: string;
}

export const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({
  phoneNumber = "573123756979",
  salesPhoneNumber = "573115401997",
  salesMessage = "Hola, quiero recibir asesoria para comprar un producto.",
  supportMessage = "Hola, necesito ayuda de un asesor de soporte."
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("whatsapp_collapsed");
    return saved === "true";
  });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("whatsapp_collapsed", String(collapsed));
    if (collapsed) setMenuOpen(false);
  }, [collapsed]);

  useEffect(() => {
    const closeWhenClickingOutside = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", closeWhenClickingOutside);
    document.addEventListener("touchstart", closeWhenClickingOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", closeWhenClickingOutside);
      document.removeEventListener("touchstart", closeWhenClickingOutside);
    };
  }, []);

  const openWhatsapp = (number: string, message: string) => {
    const cleanNumber = number.replace(/\D/g, "");
    setMenuOpen(false);
    window.open(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div ref={rootRef} className="fixed bottom-20 right-0 z-40 flex items-center lg:bottom-10">
      <button
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        aria-label={collapsed ? "Mostrar WhatsApp" : "Ocultar WhatsApp"}
        className="flex h-10 w-5 items-center justify-center rounded-l-lg bg-[#25D366] text-white shadow-md transition-colors hover:bg-[#128C7E]"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && menuOpen && (
          <motion.div
            key="contact-menu"
            initial={{ y: 12, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-16 right-4 w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-black/10 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-[#171717] lg:right-10"
          >
            <p className="px-2 pb-2 pt-1 text-xs font-bold text-black/50 dark:text-white/50">¿Con quién deseas hablar?</p>
            <button
              type="button"
              onClick={() => openWhatsapp(salesPhoneNumber, salesMessage)}
              className="group flex w-full items-center gap-3 rounded-lg bg-emerald-500/10 px-3 py-3 text-left transition hover:bg-emerald-500/20"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#25D366] text-white"><Bot size={21} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-black/85 dark:text-white">Asesor de Ventas IA</span>
                <span className="block text-xs text-black/50 dark:text-white/55">Cotiza y compra por WhatsApp</span>
              </span>
              <ChevronRight className="text-emerald-600 transition-transform group-hover:translate-x-0.5" size={18} />
            </button>
            <button
              type="button"
              onClick={() => openWhatsapp(phoneNumber, supportMessage)}
              className="group mt-2 flex w-full items-center gap-3 rounded-lg bg-sky-500/10 px-3 py-3 text-left transition hover:bg-sky-500/20"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#0866D9] text-white"><Headphones size={20} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-black/85 dark:text-white">Soporte con un Asesor</span>
                <span className="block text-xs text-black/50 dark:text-white/55">Atención personal y soporte</span>
              </span>
              <ChevronRight className="text-sky-600 transition-transform group-hover:translate-x-0.5" size={18} />
            </button>
          </motion.div>
        )}

        {!collapsed && (
          <motion.button
            key="wa-btn"
            type="button"
            initial={{ x: 80, opacity: 0, scale: 0.8 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 80, opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setMenuOpen((current) => !current)}
            aria-label="Abrir opciones de WhatsApp"
            aria-expanded={menuOpen}
            className="relative mr-4 flex items-center justify-center rounded-full border-[3px] border-white bg-[#25D366] p-3 text-white shadow-xl shadow-[#25D366]/40 transition-colors hover:bg-[#128C7E] dark:border-[#0a0a0a] lg:mr-10 lg:p-4"
          >
            <span className="block lg:hidden"><WhatsAppIcon size={22} /></span>
            <span className="hidden lg:block"><WhatsAppIcon size={28} /></span>
            <span className="absolute right-0.5 top-0.5 flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-white" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
