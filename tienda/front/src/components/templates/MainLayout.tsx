import React, { useMemo, useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@heroui/button";
import { useTheme } from "next-themes";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import { DashboardLayout } from "./DashboardLayout";
import { CategoryList } from "../organisms/CategoryList";
import { CartSummary } from "../organisms/CartSummary";
import { ProductFormModal } from "../organisms/modals/ProductFormModal";
import { ProductLightboxModal } from "../organisms/modals/ProductLightboxModal";
import { CategoryFormModal } from "../organisms/modals/CategoryFormModal";
import { SearchBar } from "../organisms/SearchBar";
import { SocialLinks, SocialLinksModal } from "../organisms/modals/SocialLinksModal";
import { CustomerZoneModal } from "../organisms/modals/CustomerZoneModal";
import { PwaCatalogModal } from "../organisms/modals/PwaCatalogModal";
import { adminService } from "../../services/admin";

import { PaymentSelectionModal } from "../organisms/modals/PaymentSelectionModal";
import { ProductReviewsModal } from "../organisms/ProductReviews";
import { TermsModal } from "../organisms/TermsModal";
import { MoonIcon, SunIcon } from "../atoms/icons";
import { Bot, FileDown, PanelLeftOpen, Smartphone } from "lucide-react";
import { FaFacebookF, FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa6";

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { logout, user, token } = useAuth();
  const {
    cart,
    isAdmin,
    categoriesData,
    products,
    statusCounts,
    isMenuOpen,
    setIsMenuOpen,
    isCartOpen,
    setIsCartOpen,
    editingProduct,
    setEditingProduct,
    isProductModalOpen,
    setIsProductModalOpen,
    editingCategory,
    setEditingCategory,
    isCategoryModalOpen,
    setIsCategoryModalOpen,
    isPaymentModalOpen,
    setIsPaymentModalOpen,
    checkoutStatus,
    handleOpenProductModal,
    handleSaveProduct,
    handleSaveCategory,
    handleEditCategory,
    handleDeleteCategory,
    handleInitiateCheckout,
    handleDirectOwner,
    handleWompiCheckout,
    handleCheckout,
    isSubmitting,
    total,
    removeFromCart,
    updateQuantity,
    clearCart,
    addToCart,

    selectedReviewsProduct,
    setSelectedReviewsProduct,
    selectedProduct,
    setSelectedProduct,
    activeCategory,
    setActiveCategory,
    activeSubcategory,
    setActiveSubcategory,
    setSearchResults,
  } = useApp();

  const isSuperAdmin = user?.role === "super_admin";
  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false);
  const [isCustomerZoneOpen, setIsCustomerZoneOpen] = useState(false);
  const [isPwaCatalogOpen, setIsPwaCatalogOpen] = useState(false);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({
    facebook_url: "",
    instagram_url: "",
    tiktok_url: "",
    youtube_url: "",
  });

  useEffect(() => {
    let active = true;
    adminService
      .getSettings()
      .then((settings) => {
        if (!active) return;
        setSocialLinks({
            facebook_url: String(settings.facebook_url || ""),
            instagram_url: String(settings.instagram_url || ""),
            tiktok_url: String(settings.tiktok_url || ""),
            youtube_url: String(settings.youtube_url || ""),
        });
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const currentPage = useMemo(() => {
    const path = location.pathname;
    if (path === "/orders") return "orders";
    if (path === "/users") return "users";
    if (path === "/low-stock") return "low-stock";
    if (path === "/suppliers" || path === "/distributors") return "suppliers";
    if (path === "/profile") return "profile";
    if (path === "/my-orders") return "my-orders";
    if (path === "/uploads") return "uploads";
    if (path === "/videos") return "videos";
    return "products";
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem("pos_active_view", currentPage);
  }, [currentPage]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const socialItems = [
    {
      key: "facebook_url" as const,
      label: "Facebook",
      icon: FaFacebookF,
      buttonClass: "bg-white text-[#1877F2] hover:bg-white/90",
      iconClass: "",
    },
    {
      key: "instagram_url" as const,
      label: "Instagram",
      icon: FaInstagram,
      buttonClass:
        "bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#FCAF45] text-white hover:brightness-110",
      iconClass: "",
    },
    {
      key: "tiktok_url" as const,
      label: "TikTok",
      icon: FaTiktok,
      buttonClass: "border border-black/10 bg-black text-white hover:bg-black/80 dark:border-white/15",
      iconClass: "[filter:drop-shadow(-1px_0_0_#25F4EE)_drop-shadow(1px_0_0_#FE2C55)]",
    },
    {
      key: "youtube_url" as const,
      label: "YouTube",
      icon: FaYoutube,
      buttonClass: "bg-[#FF0000] text-white hover:bg-[#E00000]",
      iconClass: "",
    },
  ];

  const handleSocialClick = (url: string) => {
    if (isAdmin) {
      setIsSocialModalOpen(true);
      return;
    }
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };


  const headerContent = (
    <>
      <button
        aria-expanded={isMenuOpen}
        aria-label="Abrir menú principal"
        className="app-menu-trigger group absolute z-10 flex w-[58px] flex-col items-center justify-center gap-1 rounded-lg border border-white bg-white text-[#0866D9] shadow-[0_4px_0_rgba(0,38,89,0.32)] transition-[transform,box-shadow,background-color] hover:bg-white/90 active:translate-y-0.5 active:scale-[0.98] active:shadow-[0_2px_0_rgba(0,38,89,0.32)] xl:hidden"
        title="Abrir menú"
        type="button"
        onClick={() => setIsMenuOpen(true)}
      >
        <PanelLeftOpen
          aria-hidden="true"
          className="motion-safe:animate-pulse transition-transform duration-200 group-hover:translate-x-0.5"
          size={22}
          strokeWidth={2.5}
        />
        <span className="text-[10px] font-black leading-none">MENÚ</span>
      </button>

        <div className="order-1 flex w-[58px] items-center xl:w-auto xl:gap-3">
          <Link to="/" className="hidden min-w-0 items-center gap-2.5 transition-opacity hover:opacity-85 xl:flex">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-black text-[#0866D9] shadow-md ring-1 ring-white/40 xl:size-10 xl:text-base">
            VI
          </div>
          <div className="hidden sm:flex flex-col leading-none min-w-0">
            <h1 className="whitespace-nowrap text-base font-black tracking-tight text-white xl:text-xl">
              Vega Importadora
            </h1>
            <span className="mt-1 whitespace-nowrap text-[10px] font-bold uppercase text-white/70 xl:text-xs">
              Tecnologia mayorista
            </span>
          </div>
        </Link>
      </div>

      {/* Buscador centrado en el header - desktop y móvil */}
      {currentPage === "products" && (
          <div className="order-3 flex w-full min-w-0 pl-[66px] xl:order-2 xl:mx-2 xl:w-auto xl:max-w-2xl xl:flex-1 xl:pl-0">
          <SearchBar 
            products={products} 
            onSearchResults={setSearchResults}
            className="w-full"
            compact={true}
            disableInlineFiltering={true}
            showFilters={isAdmin}
          />
        </div>
      )}

        <div className="order-2 ml-auto flex items-center gap-1 xl:order-3 xl:gap-2">
        <div className="flex items-center gap-0.5">
          {socialItems.map(({ key, label, icon: Icon, buttonClass, iconClass }) => {
            const url = socialLinks[key];
            return (
              <button
                key={key}
                aria-label={isAdmin ? `Configurar ${label}` : `Abrir ${label}`}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-[filter,background-color,opacity] disabled:cursor-not-allowed disabled:opacity-35 sm:h-8 sm:w-8 ${buttonClass}`}
                disabled={!isAdmin && !url}
                title={isAdmin ? `Configurar redes sociales` : url ? `Visitar ${label}` : `${label} próximamente`}
                type="button"
                onClick={() => handleSocialClick(url)}
              >
                <Icon className={iconClass} size={16} />
              </button>
            );
          })}
        </div>

        <Button
          isIconOnly
          as="a"
          className="bg-[#DC2626] text-white hover:bg-[#B91C1C]"
          href="/tienda-api/api/catalog.pdf"
          size="sm"
          title="Descargar catálogo PDF actualizado"
          variant="flat"
        >
          <FileDown size={17} />
        </Button>

        <Button
          isIconOnly
          className="bg-white text-[#0866D9] hover:bg-white/90"
          size="sm"
          title="Instalar app y actualizar catalogo offline"
          variant="flat"
          onClick={() => setIsPwaCatalogOpen(true)}
        >
          <Smartphone size={17} />
        </Button>

        <Button
          isIconOnly
          as="a"
          className="bg-white/15 text-white hover:bg-white/25"
          href="/login"
          size="sm"
          title="Acceso al bot"
          variant="flat"
        >
          <Bot size={18} />
        </Button>

        <Button
          isIconOnly
          className="bg-white/15 text-white hover:bg-white/25"
          size="sm"
          variant="flat"
          onClick={toggleTheme}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </Button>

        <Button
          className="hidden bg-white/15 text-xs font-bold text-white hover:bg-white/25 xl:flex"
          size="sm"
          variant="flat"
          onClick={logout}
        >
          Cerrar Sesión
        </Button>
      </div>
    </>
  );

  return (
    <>
      <DashboardLayout
        isAdmin={isAdmin}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        isCartOpen={isCartOpen}
        setIsCartOpen={setIsCartOpen}
        onProfileClick={() => navigate("/profile")}
        onMyOrdersClick={() => navigate("/my-orders")}
        onCustomerZoneClick={() => setIsCustomerZoneOpen(true)}
        cartItemCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        cartTotal={total}
        headerContent={headerContent}
        sidebarContent={
          <CategoryList
            categories={categoriesData}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            activeSubcategory={activeSubcategory}
            setActiveSubcategory={setActiveSubcategory}
            isMenuOpen={isMenuOpen}
            isAdmin={isAdmin}
            isSuperAdmin={isSuperAdmin}
            setIsMenuOpen={setIsMenuOpen}
            isMobile={false}
            activeView={
              currentPage as
                | "products"
                | "orders"
                | "users"
                | "low-stock"
                | "suppliers"
              | "uploads"
                | "videos"
            }
            setActiveView={(v) => {
              if (v === "products") navigate("/");
              else if (v === "orders") navigate("/orders");
              else if (v === "users") navigate("/users");
              else if (v === "low-stock") navigate("/low-stock");
              else if (v === "suppliers") navigate("/distributors");
              else if (v === "uploads") navigate("/uploads");
              else if (v === "videos") navigate("/videos");
            }}
            lowStockCount={products.filter((p) => p.stock <= 3).length}
            pendingOrdersCount={statusCounts["PENDIENTE"] || 0}
            handleOpenProductModal={handleOpenProductModal}
            setIsCategoryModalOpen={() => {
              setEditingCategory(null);
              setIsCategoryModalOpen(true);
            }}
            onEditCategory={handleEditCategory}
            onDeleteCategory={handleDeleteCategory}
          />
        }
        cartSidebarContent={
          <CartSummary
            cart={cart}
            checkoutStatus={checkoutStatus}
            total={total}
            isSubmitting={isSubmitting}
            handleInitiateCheckout={handleInitiateCheckout}
            removeFromCart={removeFromCart}
            updateQuantity={updateQuantity}
            clearCart={clearCart}
          />
        }
      >
        {children}
      </DashboardLayout>

      {/* Modal de Términos y Condiciones - Primera visita */}
      <TermsModal />

      <CustomerZoneModal isOpen={isCustomerZoneOpen} onOpenChange={setIsCustomerZoneOpen} />
      <PwaCatalogModal isOpen={isPwaCatalogOpen} onOpenChange={setIsPwaCatalogOpen} />

      {selectedReviewsProduct && (
        <ProductReviewsModal
          selectedProduct={selectedReviewsProduct}
          isOpen={!!selectedReviewsProduct}
          onOpenChange={(open) => {
            if (!open) setSelectedReviewsProduct(null);
          }}
        />
      )}

      <ProductLightboxModal
        isOpen={!!selectedProduct}
        selectedProduct={selectedProduct}
        onAddToCart={addToCart}
        onOpenReviews={(product) => setSelectedReviewsProduct(product)}
        onOpenChange={(open) => {
          if (!open) setSelectedProduct(null);
        }}
      />

      {isProductModalOpen && (
        <ProductFormModal
          editingProduct={editingProduct}
          setEditingProduct={setEditingProduct}
          categoriesData={categoriesData}
          token={token}
          isOpen={isProductModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsProductModalOpen(false);
              setEditingProduct(null);
            }
          }}
          handleSaveProduct={handleSaveProduct}
          isSubmitting={isSubmitting}
        />
      )}

      {isCategoryModalOpen && (
        <CategoryFormModal
          editingCategory={editingCategory}
          setEditingCategory={setEditingCategory}
          isOpen={isCategoryModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsCategoryModalOpen(false);
              setEditingCategory(null);
            }
          }}
          handleSaveCategory={handleSaveCategory}
          isSubmitting={isSubmitting}
        />
      )}

      {isPaymentModalOpen && (
        <PaymentSelectionModal
          isOpen={isPaymentModalOpen}
          onOpenChange={(open) => setIsPaymentModalOpen(open)}
          handleCheckout={handleCheckout}
          onDirectOwner={handleDirectOwner}
          onWompiCheckout={handleWompiCheckout}
        />
      )}

      {isAdmin && (
        <SocialLinksModal
          isOpen={isSocialModalOpen}
          links={socialLinks}
          token={token}
          onOpenChange={setIsSocialModalOpen}
          onSaved={setSocialLinks}
        />
      )}
    </>
  );
};
