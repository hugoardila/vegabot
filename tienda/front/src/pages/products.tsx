import React, { useMemo, useRef } from "react";
import { Pagination } from "@heroui/pagination";
import { PanelLeftOpen } from "lucide-react";
import { useApp } from "../context/AppContext";
import { ProductCard } from "../components/organisms/ProductCard";
import { CategoryBarMobile } from "../components/organisms/CategoryBarMobile";
import { HeroBanner } from "../components/organisms/HeroBanner";
import { useAuth } from "../context/AuthContext";
import { usePagination } from "../hooks/usePagination";
import { FeaturedProductsCarousel } from "../components/organisms/FeaturedProductsCarousel";

const NOVELTIES_SUBCATEGORY_ID = "__novedades__";

export const ProductsPage: React.FC = () => {
  const productsStartRef = useRef<HTMLDivElement>(null);
  const {
    categories,
    categoriesData,
    products,
    cart,
    addToCart,
    isAdmin,
    escena1Url,
    escena2Url,
    handleViewProduct,
    handleOpenProductModal,
    handleDeleteProduct,
    handleUpdateProductStatus,
    fetchData,
    activeCategory,
    setActiveCategory,
    activeSubcategory,
    setActiveSubcategory,
    searchResults,
    setIsMenuOpen,
  } = useApp();

  const { user, token } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const filteredProducts = useMemo(() => {
    let filtered = searchResults;
    
    if (activeCategory !== "Todos") {
      filtered = filtered.filter((p) => p.category_name === activeCategory);
    }
    if (activeSubcategory !== "Todos") {
      filtered = activeSubcategory === NOVELTIES_SUBCATEGORY_ID
        ? filtered.filter((p) => Boolean(p.free_shipping) || Boolean(p.promotion_enabled))
        : filtered.filter((p) => p.subcategory_id === activeSubcategory);
    }
    
    return filtered;
  }, [searchResults, activeCategory, activeSubcategory]);

  const {
    currentPage,
    setCurrentPage,
    pages,
    paginatedItems: paginatedProducts,
  } = usePagination(filteredProducts, 12, [searchResults, activeCategory, activeSubcategory]);

  const activeSubcategoryName = categoriesData
    .flatMap((category) => category.subcategories || [])
    .find((subcategory) => subcategory.id === activeSubcategory)?.name;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const header = document.querySelector("main > header");
      const catalogScroller = header?.nextElementSibling as HTMLElement | null;
      const categoryBar = catalogScroller?.querySelector<HTMLElement>("[data-mobile-category-bar]");
      const productsStart = productsStartRef.current;

      if (!catalogScroller || !productsStart) return;

      const targetTop = Math.max(
        0,
        catalogScroller.scrollTop
          + productsStart.getBoundingClientRect().top
          - catalogScroller.getBoundingClientRect().top
          - (categoryBar?.offsetHeight || 0),
      );

      catalogScroller.scrollTo({
        top: targetTop,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    });
  };

  return (
    <>
      <CategoryBarMobile
        categories={categories}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        activeSubcategory={activeSubcategory}
        setActiveSubcategory={setActiveSubcategory}
        categoriesData={categoriesData}
      />

      {activeCategory === "Todos" && (
        <>
          <HeroBanner
            escena1Url={escena1Url}
            escena2Url={escena2Url}
            isAdmin={isSuperAdmin}
            token={token}
            onRefresh={fetchData}
          />
          <FeaturedProductsCarousel
            products={products}
            cart={cart}
            addToCart={addToCart}
            handleViewProduct={handleViewProduct}
            isAdmin={isAdmin}
            token={token}
          />
        </>
      )}

      <div ref={productsStartRef} className="mb-6 mt-6 scroll-mt-4">
        <h2 className="text-2xl lg:text-3xl font-bold mb-1">
          {isAdmin
            ? "Catálogo de Productos"
            : `Explorar ${activeSubcategoryName || activeCategory}`}
        </h2>
        {filteredProducts.length === 0 && (
          <p className="text-sm text-black/60 dark:text-white/60 mt-2">
            No se encontraron productos que coincidan con tu búsqueda.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-6">
        {paginatedProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            isAdmin={isAdmin}
            cartQuantity={
              cart.find((c) => c.product.id === product.id)?.quantity || 0
            }
            addToCart={addToCart}
            handleViewProduct={handleViewProduct}
            handleOpenProductModal={handleOpenProductModal}
            handleDeleteProduct={handleDeleteProduct}
            handleUpdateProductStatus={handleUpdateProductStatus}
          />
        ))}
      </div>

      {pages > 1 && (
        <div className="mt-10 mb-4 flex w-full items-center justify-center gap-2">
          <button
            aria-label="Abrir menú"
            className="flex h-9 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2.5 text-[11px] font-black text-[#0866D9] shadow-sm transition-transform active:scale-95 dark:border-white/15 dark:bg-white/10 dark:text-white xl:hidden"
            title="Abrir menú"
            type="button"
            onClick={() => setIsMenuOpen(true)}
          >
            <PanelLeftOpen aria-hidden="true" size={16} strokeWidth={2.5} />
            <span>MENÚ</span>
          </button>
          <Pagination
            isCompact
            showControls
            color="primary"
            page={currentPage}
            total={pages}
            onChange={handlePageChange}
            variant="light"
          />
        </div>
      )}

      {pages <= 1 && (
        <button
          aria-label="Abrir menú"
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-30 flex h-11 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 text-[11px] font-black text-[#0866D9] shadow-lg transition-transform active:scale-95 dark:border-white/15 dark:bg-[#171717] dark:text-white xl:hidden"
          title="Abrir menú"
          type="button"
          onClick={() => setIsMenuOpen(true)}
        >
          <PanelLeftOpen aria-hidden="true" size={17} strokeWidth={2.5} />
          <span>MENÚ</span>
        </button>
      )}
    </>
  );
};
