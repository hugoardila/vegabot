import React, { useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Pagination } from "@heroui/pagination";
import { Button } from "@heroui/button";
import { ArrowLeft, SearchX, SlidersHorizontal } from "lucide-react";
import { useApp } from "../context/AppContext";
import { ProductCard } from "../components/organisms/ProductCard";
import { usePagination } from "../hooks/usePagination";
import { applyCatalogFilters, countActiveCatalogFilters, emptyCatalogFilters, parseCatalogFilters } from "../utils/catalogFilters";

export const SearchResultsPage: React.FC = () => {
  const resultsStartRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const searchQuery = searchParams.get("q") || "";
  const searchParamsKey = searchParams.toString();
  
  const {
    products,
    cart,
    addToCart,
    isAdmin,
    handleViewProduct,
    handleOpenProductModal,
    handleDeleteProduct,
    handleUpdateProductStatus,
  } = useApp();

  const filters = useMemo(
    () => isAdmin ? parseCatalogFilters(searchParams) : emptyCatalogFilters,
    [searchParamsKey, isAdmin]
  );
  const activeFilterCount = countActiveCatalogFilters(filters);

  const searchResults = useMemo(() => {
    return applyCatalogFilters(products, searchQuery, filters);
  }, [products, searchQuery, filters]);

  // Productos similares (misma categoría que los resultados)
  const similarProducts = useMemo(() => {
    if (!searchQuery.trim() || searchResults.length === 0) return [];
    
    // Obtener categorías de los resultados
    const resultCategories = [...new Set(searchResults.map(p => p.category_name))];
    
    // Encontrar productos en esas categorías que no estén en los resultados
    return products.filter(p =>
      resultCategories.includes(p.category_name || "") &&
      !searchResults.find(r => r.id === p.id)
    ).slice(0, 8); // Máximo 8 productos similares
  }, [products, searchResults, searchQuery]);

  const {
    currentPage,
    setCurrentPage,
    pages,
    paginatedItems: paginatedResults,
  } = usePagination(searchResults, 12, [searchParamsKey]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      resultsStartRef.current?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  return (
    <div ref={resultsStartRef} className="w-full scroll-mt-4">
      {/* Header con botón volver */}
      <div className="mb-6 flex items-center gap-4">
        <Button
          isIconOnly
          variant="flat"
          className="bg-black/5 dark:bg-white/5"
          onClick={() => navigate("/")}
        >
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">
            {searchQuery ? "Resultados de búsqueda" : "Productos filtrados"}
          </h1>
          <p className="text-sm text-black/60 dark:text-white/60 mt-1">
            {searchQuery ? (
              <>Buscando: <span className="font-semibold">"{searchQuery}"</span></>
            ) : (
              "Explora los productos que cumplen las condiciones seleccionadas"
            )}
          </p>
        </div>
      </div>

      {/* Contador de resultados */}
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl lg:text-2xl font-bold">
          {searchResults.length === 0 ? (
            <>No se encontraron resultados</>
          ) : (
            <>
              {searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""}
            </>
          )}
          </h2>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <SlidersHorizontal size={13} />
              {activeFilterCount} filtro{activeFilterCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Resultados de búsqueda */}
      {searchResults.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-6">
            {paginatedResults.map((product) => (
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
            <div className="flex w-full justify-center mt-10 mb-8">
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
        </>
      )}

      {/* Productos similares */}
      {similarProducts.length > 0 && (
        <div className="mt-12 pt-8 border-t border-black/10 dark:border-white/10">
          <div className="mb-6">
            <h2 className="text-xl lg:text-2xl font-bold mb-1">
              Productos Similares
            </h2>
            <p className="text-sm text-black/60 dark:text-white/60">
              También te pueden interesar estos productos
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-6">
            {similarProducts.map((product) => (
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
        </div>
      )}

      {/* Mensaje cuando no hay resultados */}
      {searchResults.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <SearchX className="mb-4 text-black/20 dark:text-white/20" size={54} />
          <h3 className="text-xl font-bold mb-2">No se encontraron resultados</h3>
          <p className="text-black/60 dark:text-white/60 mb-6 max-w-md">
            Intenta buscar con otras palabras clave o explora nuestro catálogo completo
          </p>
          <Button
            color="primary"
            variant="flat"
            onClick={() => navigate("/")}
          >
            Ver todos los productos
          </Button>
        </div>
      )}
    </div>
  );
};
