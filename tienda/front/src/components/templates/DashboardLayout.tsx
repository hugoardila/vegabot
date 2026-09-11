import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { UsersRound, X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
} from "@heroui/drawer";
import { WhatsAppButton } from "../atoms/WhatsAppButton";
import { WhatsAppIcon, UserIcon, ShoppingBagIcon } from "../atoms/icons";
import { WHATSAPP_SALES_NUMBER, WHATSAPP_SUPPORT_NUMBER } from "../../config/api";

interface DashboardLayoutProps {
  sidebarContent: React.ReactNode;
  headerContent: React.ReactNode;
  cartSidebarContent: React.ReactNode;
  children: React.ReactNode;
  isAdmin: boolean;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  onProfileClick?: () => void;
  onMyOrdersClick?: () => void;
  onCustomerZoneClick?: () => void;
  cartItemCount?: number;
  cartTotal?: number;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  sidebarContent,
  headerContent,
  cartSidebarContent,
  children,
  isAdmin,
  isMenuOpen,
  setIsMenuOpen,
  isCartOpen,
  setIsCartOpen,
  onProfileClick,
  onMyOrdersClick,
  onCustomerZoneClick,
  cartItemCount = 0,
  cartTotal = 0,
}) => {
  const location = useLocation();
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => {
    const saved = localStorage.getItem("pos_sidebar_open");
    return saved !== "false"; // defaults to true
  });

  useEffect(() => {
    localStorage.setItem("pos_sidebar_open", String(desktopSidebarOpen));
  }, [desktopSidebarOpen]);

  useEffect(() => {
    const resetCatalogScroll = () => {
      contentScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    resetCatalogScroll();
    const animationFrame = window.requestAnimationFrame(resetCatalogScroll);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [location.pathname, location.search]);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const updateHeaderHeight = () => setHeaderHeight(header.getBoundingClientRect().height);
    updateHeaderHeight();

    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1279px)");
    const update = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(event.matches);
    };

    update(query);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const whatsappSupportUrl = `https://wa.me/${WHATSAPP_SUPPORT_NUMBER}?text=Hola,%20necesito%20soporte%20técnico%20o%20tengo%20una%20sugerencia.`;

  return (
    <div className="flex h-screen h-dvh w-screen overflow-hidden bg-[#f8f9fa] font-sans text-black selection:bg-primary selection:text-white dark:bg-[#0a0a0a] dark:text-white">
      {/* ── Sidebar Desktop ─────────────────────────────────────────────────── */}
      <div className={`relative z-50 hidden shrink-0 transition-all duration-300 xl:block ${desktopSidebarOpen ? "w-64" : "w-0"}`}>
        <aside className={`w-64 border-r border-black/10 dark:border-white/10 flex flex-col bg-white dark:bg-[#0a0a0a] h-screen overflow-hidden absolute top-0 left-0 transition-transform duration-300 ${desktopSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          {/* Logo — fijo arriba */}
          <Link to="/" className="flex items-center gap-2 px-8 py-6 shrink-0 hover:opacity-80 transition-opacity">
            <div className="size-8 bg-yellow-400 rounded-lg flex items-center justify-center font-bold text-lg text-black">
              V
            </div>
            <h1 className="text-xl font-bold tracking-tight">Vega</h1>
          </Link>

          {/* Zona scrolleable */}
          <div
            data-category-scroll-container
            className="flex-1 overflow-y-auto px-6 flex flex-col gap-6 pb-4
              [&::-webkit-scrollbar]:w-1.5
              [&::-webkit-scrollbar-track]:bg-transparent
              [&::-webkit-scrollbar-thumb]:bg-black/15
              dark:[&::-webkit-scrollbar-thumb]:bg-white/15
              [&::-webkit-scrollbar-thumb]:rounded-full"
          >
            {sidebarContent}
          </div>

          {/* Soporte + versión — fijo abajo */}
          <div className="shrink-0 px-6 pb-6 pt-3 flex flex-col gap-3 border-t border-black/5 dark:border-white/5">
            {!isAdmin && (
              <a
                className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-primary/10 hover:bg-primary/20 text-primary transition-all group border border-primary/10"
                href={whatsappSupportUrl}
                rel="noreferrer"
                target="_blank"
              >
                <div className="size-8 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                  <WhatsAppIcon size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold leading-none mb-1">
                    Soporte Técnico
                  </span>
                  <span className="text-[10px] opacity-60 leading-none">
                    Inquietudes y sugerencias
                  </span>
                </div>
              </a>
            )}

            {!isAdmin && (
              <button
                className="flex items-center gap-3 px-3 py-3 rounded-2xl border text-sm font-bold transition-all bg-primary/5 text-primary border-primary/15 hover:bg-primary/10 cursor-pointer"
                onClick={onCustomerZoneClick}
              >
                <div className="size-8 rounded-xl flex items-center justify-center bg-primary text-white shadow-lg shadow-primary/20">
                  <UsersRound size={18} />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold leading-none mb-1">Zona Clientes</span>
                  <span className="text-[10px] opacity-60 leading-none">Ingresar con datos SAINT</span>
                </div>
              </button>
            )}

            {!isAdmin && (
              <button
                className="flex items-center gap-3 px-3 py-3 rounded-2xl border text-sm font-bold transition-all bg-black/5 dark:bg-white/5 text-black dark:text-white border-black/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                onClick={onMyOrdersClick}
              >
                <div className="size-8 rounded-xl flex items-center justify-center bg-black/10 dark:bg-white/10 text-black dark:text-white">
                  <ShoppingBagIcon size={18} />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold leading-none mb-1">Mis Pedidos</span>
                  <span className="text-[10px] opacity-60 leading-none">Ver historial</span>
                </div>
              </button>
            )}

            <button
              className="flex items-center gap-3 px-3 py-3 rounded-2xl border text-sm font-bold transition-all bg-black/5 dark:bg-white/5 text-black dark:text-white border-black/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
              onClick={onProfileClick}
            >
              <div className="size-8 rounded-xl flex items-center justify-center bg-black/10 dark:bg-white/10 text-black dark:text-white">
                <UserIcon size={18} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold leading-none mb-1">Mi Cuenta</span>
                <span className="text-[10px] opacity-60 leading-none">Ver perfil</span>
              </div>
            </button>
          </div>
        </aside>

        <button
          aria-label={desktopSidebarOpen ? "Ocultar menú lateral" : "Mostrar menú lateral"}
          type="button"
          onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
          className={`absolute top-6 z-50 flex items-center justify-center size-7 bg-white dark:bg-[#0a0a0a] border border-black/10 dark:border-white/10 rounded-full shadow-md text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:scale-110 transition-all cursor-pointer ${desktopSidebarOpen ? "right-[-14px]" : "right-[-42px]"}`}
          title={desktopSidebarOpen ? "Ocultar menú" : "Mostrar menú"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: desktopSidebarOpen ? "rotate(0)" : "rotate(180deg)", transition: "transform 0.3s" }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main
        className="flex-grow flex flex-col h-full overflow-hidden w-full xl:w-auto relative"
        style={isMobile && headerHeight ? { paddingTop: headerHeight } : undefined}
      >
        <header ref={headerRef} className="app-shell-header fixed inset-x-0 top-0 z-40 flex min-h-20 shrink-0 flex-wrap items-center justify-between gap-y-2 border-b border-[#0554B5] bg-[#0866D9]/95 px-3 py-2 text-white shadow-sm backdrop-blur-md dark:border-[#0554B5] dark:bg-[#0866D9]/95 dark:text-white sm:px-4 xl:relative xl:h-20 xl:flex-nowrap xl:px-6 xl:py-0">
          {headerContent}
        </header>
        <div ref={contentScrollRef} className="min-h-0 flex-grow overflow-y-auto bg-[#f8f9fa] p-4 pb-24 overscroll-contain [-webkit-overflow-scrolling:touch] dark:bg-[#0a0a0a] lg:p-6 lg:pb-28">
          {children}
        </div>
      </main>

      {/* ── Cart Sidebar Desktop ─────────────────────────────────────────────── */}
      {!isAdmin && isCartOpen && (
        <>
          <button
            aria-label="Cerrar carrito"
            className="fixed inset-0 z-40 hidden cursor-default bg-black/25 backdrop-blur-[1px] xl:block"
            type="button"
            onClick={() => setIsCartOpen(false)}
          />
          <section
            aria-label="Resumen del carrito"
            aria-modal="true"
            className="fixed bottom-24 left-1/2 z-50 hidden max-h-[min(70vh,680px)] w-[min(92vw,720px)] -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0d0d0d] xl:flex"
            role="dialog"
          >
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-3 dark:border-white/10">
              <div className="flex items-center gap-2">
                <ShoppingBagIcon size={18} />
                <h2 className="text-sm font-bold">Carrito de compras</h2>
              </div>
              <button
                aria-label="Cerrar carrito"
                className="flex size-8 items-center justify-center rounded-full bg-black/5 text-lg leading-none transition-colors hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
                title="Cerrar"
                type="button"
                onClick={() => setIsCartOpen(false)}
              >
                <X aria-hidden="true" size={17} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {cartSidebarContent}
            </div>
          </section>
        </>
      )}

      {!isAdmin && (
        <div className={`fixed bottom-4 left-1/2 z-30 -translate-x-1/2 xl:bottom-5 xl:z-50 ${isCartOpen ? "hidden xl:block" : ""}`}>
          <button
            aria-expanded={isCartOpen}
            aria-label={`${isCartOpen ? "Cerrar" : "Abrir"} carrito de compras. Subtotal $${new Intl.NumberFormat("es-CO").format(cartTotal)}`}
            className="relative flex size-14 items-center justify-center rounded-full border border-black/10 bg-[#171717] text-white shadow-2xl transition-transform hover:-translate-y-1 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:border-white/15"
            title={isCartOpen ? "Cerrar carrito" : "Abrir carrito"}
            type="button"
            onClick={() => setIsCartOpen(!isCartOpen)}
          >
            <ShoppingBagIcon size={23} />
            {cartItemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-[#0a0a0a]">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ── Mobile Drawers (HeroUI) ──────────────────────────────────────────── */}

      {/* Menú izquierda */}
      <Drawer
        disableAnimation
        backdrop="opaque"
        className="bg-white dark:bg-[#0a0a0a] text-black dark:text-white"
        isOpen={isMenuOpen}
        placement="left"
        shouldBlockScroll={false}
        size="xs"
        onOpenChange={setIsMenuOpen}
      >
        <DrawerContent>
          <DrawerHeader className="border-b border-black/10 dark:border-white/10">
            Vega Catálogo
          </DrawerHeader>
          <DrawerBody
            data-category-scroll-container
            className="flex flex-col gap-6 p-6"
            style={{ overflowY: "auto" }}
          >
            <div className="flex-grow">{sidebarContent}</div>

            <div className="flex flex-col gap-3">
              {!isAdmin && (
                <button
                  className="flex items-center gap-3 px-3 py-3 rounded-2xl border text-sm font-bold transition-all bg-black/5 dark:bg-white/5 text-black dark:text-white border-black/5 dark:border-white/5"
                  onClick={() => {
                    onMyOrdersClick?.();
                    setIsMenuOpen(false);
                  }}
                >
                  <div className="size-8 bg-black/10 dark:bg-white/10 rounded-xl flex items-center justify-center">
                    <ShoppingBagIcon size={18} />
                  </div>
                  Mis Pedidos
                </button>
              )}

              <button
                className="flex items-center gap-3 px-3 py-3 rounded-2xl border text-sm font-bold transition-all bg-black/5 dark:bg-white/5 text-black dark:text-white border-black/5 dark:border-white/5"
                onClick={() => {
                  onProfileClick?.();
                  setIsMenuOpen(false);
                }}
              >
                <div className="size-8 bg-black/10 dark:bg-white/10 rounded-xl flex items-center justify-center">
                  <UserIcon size={18} />
                </div>
                Mi Perfil
              </button>

              {!isAdmin && (
                <a
                  className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors border border-primary/10"
                  href={whatsappSupportUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <div className="size-8 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                    <WhatsAppIcon size={18} />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold leading-none mb-1">
                      Soporte Técnico
                    </span>
                    <span className="text-[10px] opacity-60 leading-none">
                      Inquietudes y sugerencias
                    </span>
                  </div>
                </a>
              )}

              {!isAdmin && (
                <button
                  className="flex items-center gap-3 px-3 py-3 rounded-2xl border text-sm font-bold transition-all bg-primary/5 text-primary border-primary/15"
                  onClick={() => {
                    onCustomerZoneClick?.();
                    setIsMenuOpen(false);
                  }}
                >
                  <div className="size-8 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                    <UsersRound size={18} />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold leading-none mb-1">Zona Clientes</span>
                    <span className="text-[10px] opacity-60 leading-none">Ingresar con datos SAINT</span>
                  </div>
                </button>
              )}
            </div>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Carrito derecha (solo móvil) */}
      {isMobile && !isAdmin && (
        <div className="xl:hidden">
          <Drawer
            disableAnimation
            backdrop="opaque"
            className="bg-white dark:bg-[#0d0d0d] text-black dark:text-white"
            isOpen={isCartOpen}
            placement="right"
            shouldBlockScroll={false}
            size="xs"
            onOpenChange={setIsCartOpen}
          >
            <DrawerContent>
              <DrawerHeader className="border-b border-black/10 dark:border-white/10">
                Venta Actual
              </DrawerHeader>
              <DrawerBody style={{ overflowY: "auto", padding: "1.5rem" }}>
                {cartSidebarContent}
              </DrawerBody>
            </DrawerContent>
          </Drawer>
        </div>
      )}

      {!isAdmin && (
        <WhatsAppButton
          phoneNumber={WHATSAPP_SUPPORT_NUMBER}
          salesPhoneNumber={WHATSAPP_SALES_NUMBER}
        />
      )}
    </div>
  );
};
