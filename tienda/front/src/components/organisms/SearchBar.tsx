import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Product } from "../../types";
import { useApp } from "../../context/AppContext";
import { CatalogFilterModal } from "./modals/CatalogFilterModal";
import {
  applyCatalogFilters,
  buildCatalogSearchParams,
  CatalogFilters,
  countActiveCatalogFilters,
  emptyCatalogFilters,
  parseCatalogFilters,
} from "../../utils/catalogFilters";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8080/api").replace("/api", "");
const getImageUrl = (url: string) => url.startsWith("http") ? url : `${API_BASE}${url}`;

interface SearchBarProps {
  products: Product[];
  onSearchResults: (results: Product[]) => void;
  className?: string;
  compact?: boolean;
  disableInlineFiltering?: boolean; // Nueva prop para desactivar el filtrado inline
  showFilters?: boolean;
}

export function SearchBar({ products, onSearchResults, className = "", compact = false, disableInlineFiltering = false, showFilters = false }: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<CatalogFilters>(emptyCatalogFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleViewProduct } = useApp();
  const searchParamsKey = searchParams.toString();
  const activeFilterCount = showFilters ? countActiveCatalogFilters(filters) : 0;

  useEffect(() => {
    setSearchTerm(searchParams.get("q") || "");
    setFilters(showFilters ? parseCatalogFilters(searchParams) : emptyCatalogFilters);
  }, [searchParamsKey, showFilters]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      if (!disableInlineFiltering) {
        onSearchResults(applyCatalogFilters(products, "", filters));
      }
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const filtered = applyCatalogFilters(products, searchTerm, filters);

    // Solo actualizar resultados si NO está desactivado el filtrado inline
    if (!disableInlineFiltering) {
      onSearchResults(filtered);
    }
    
    // ⚡ IMPORTANTE: Limitar a máximo 5 sugerencias para no saturar la vista
    const maxSuggestions = 5;
    setSuggestions(filtered.slice(0, maxSuggestions));
    
    // Mostrar sugerencias inmediatamente si el input está enfocado
    if (filtered.length > 0) {
      setShowSuggestions(true);
    }
  }, [searchTerm, products, filters, disableInlineFiltering]);

  // Cerrar sugerencias al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Actualizar posición del dropdown
  useEffect(() => {
    if (showSuggestions && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [showSuggestions]);

  const handleClear = () => {
    setSearchTerm("");
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    inputRef.current?.blur();
    
    const params = buildCatalogSearchParams(searchTerm, showFilters ? filters : emptyCatalogFilters);
    navigate(params.toString() ? `/search?${params.toString()}` : "/");
  };

  const handleApplyFilters = (nextFilters: CatalogFilters) => {
    setIsFilterOpen(false);
    setFilters(nextFilters);
    setShowSuggestions(false);
    const params = buildCatalogSearchParams(searchTerm, nextFilters);
    navigate(params.toString() ? `/search?${params.toString()}` : "/");
  };

  const handleSuggestionClick = (product: Product) => {
    setShowSuggestions(false);
    setSearchTerm("");
    setIsFocused(false);
    handleViewProduct(product);
  };

  // Clases condicionales según el modo
  const height = compact ? "h-10" : "h-12 md:h-14";
  const iconSize = compact ? 18 : 20;
  const buttonSize = compact ? "size-8" : "size-9 md:size-11";

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <form 
        onSubmit={handleSearch}
        className="relative"
      >
        <div 
          className={`
            relative flex items-center gap-2 
            ${compact ? 'bg-white' : 'bg-white dark:bg-black/20'}
            rounded-full 
            border-2 transition-all duration-200
            ${isFocused 
              ? 'border-primary shadow-lg shadow-primary/20 ring-4 ring-primary/10' 
              : compact
                ? 'border-black/10 hover:border-black/20'
                : 'border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20'
            }
          `}
        >
          {/* Icono de búsqueda izquierda */}
          <div className={`absolute ${compact ? 'left-3' : 'left-4'} flex items-center pointer-events-none`}>
            <Search 
              size={iconSize} 
              className={`transition-colors duration-200 ${
                isFocused
                  ? 'text-primary'
                  : compact ? 'text-black/40' : 'text-black/40 dark:text-white/40'
              }`}
            />
          </div>

          {/* Input de búsqueda */}
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              // Mostrar sugerencias inmediatamente si ya hay texto y resultados
              if (searchTerm && suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onBlur={() => {
              // Delay para permitir clic en sugerencias antes de cerrar
              setTimeout(() => {
                setIsFocused(false);
                setShowSuggestions(false);
              }, 150);
            }}
            placeholder="Buscar productos..."
            className={`
              w-full ${height}
              ${compact
                ? showFilters ? 'pl-10 pr-28' : 'pl-10 pr-20'
                : showFilters ? 'pl-12 pr-32' : 'pl-12 pr-24'}
              bg-transparent
              ${compact
                ? 'text-black placeholder:text-black/40'
                : 'text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40'}
              ${compact ? 'text-sm' : 'text-sm md:text-base'}
              font-medium
              outline-none
              rounded-full
            `}
          />

          {/* Botón para limpiar */}
          {searchTerm && (
            <button
              type="button"
              onClick={handleClear}
              className={`
                absolute ${showFilters
                  ? compact ? 'right-[4.75rem]' : 'right-[5.5rem] md:right-[7rem]'
                  : compact ? 'right-10' : 'right-12 md:right-14'}
                flex items-center justify-center
                ${compact ? 'size-6' : 'size-7 md:size-8'}
                ${compact
                  ? 'text-black/40 hover:bg-black/5 hover:text-black/60'
                  : 'text-black/40 dark:text-white/40 hover:text-black/60 dark:hover:text-white/60 hover:bg-black/5 dark:hover:bg-white/5'}
                rounded-full
                transition-all duration-200
                active:scale-90
              `}
              title="Limpiar búsqueda"
            >
              <X size={14} />
            </button>
          )}

          {showFilters && (
            <button
              aria-label="Abrir filtros de productos"
              className={`
                absolute ${compact ? 'right-10 size-8' : 'right-11 size-9 md:right-14 md:size-11'}
                flex items-center justify-center rounded-full
                border border-black/10 bg-black/5 text-black/60
                transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-primary
                active:scale-95 ${compact ? '' : 'dark:border-white/10 dark:bg-white/5 dark:text-white/70'}
              `}
              title="Filtrar productos"
              type="button"
              onClick={() => {
                setShowSuggestions(false);
                setIsFilterOpen(true);
              }}
            >
              <SlidersHorizontal size={compact ? 15 : 18} />
              {activeFilterCount > 0 && (
                <span className="absolute -right-0.5 -top-1 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-black leading-4 text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}

          {/* Botón de búsqueda */}
          <button
            type="submit"
            className={`
              absolute right-1
              flex items-center justify-center
              ${buttonSize}
              bg-primary
              text-white
              rounded-full
              hover:bg-primary/90
              active:scale-95
              transition-all duration-200
              shadow-lg shadow-primary/30
            `}
            title="Buscar"
          >
            <Search size={compact ? 16 : 18} className={compact ? '' : 'md:w-5 md:h-5'} />
          </button>
        </div>
      </form>

      {showFilters && (
        <CatalogFilterModal
          filters={filters}
          isOpen={isFilterOpen}
          products={products}
          onApply={handleApplyFilters}
          onOpenChange={setIsFilterOpen}
        />
      )}

      {/* Dropdown de sugerencias usando Portal */}
      {showSuggestions && suggestions.length > 0 && createPortal(
        <div
          ref={suggestionsRef}
          className="rounded-2xl shadow-2xl overflow-hidden max-h-[70vh] overflow-y-auto"
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top + 8}px`,
            left: window.innerWidth < 640 ? '16px' : `${dropdownPosition.left}px`,
            right: window.innerWidth < 640 ? '16px' : 'auto',
            width: window.innerWidth < 640 ? 'auto' : `${dropdownPosition.width}px`,
            backgroundColor: '#ffffff',
            border: '2px solid rgba(0, 0, 0, 0.1)',
            zIndex: 999999,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          }}
        >
          <div className="py-2" style={{ backgroundColor: '#ffffff' }}>
            <div 
              className="px-3 sm:px-4 py-2 text-xs font-semibold uppercase tracking-wide flex items-center justify-between"
              style={{ 
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                color: 'rgba(0, 0, 0, 0.6)',
              }}
            >
              <span>Sugerencias</span>
              <span className="text-primary font-bold">{suggestions.length} de {Math.min(suggestions.length, 5)}</span>
            </div>
            {suggestions.map((product) => (
              <button
                key={product.id}
                type="button"
                onMouseDown={(e) => {
                  // Prevenir el onBlur del input
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSuggestionClick(product);
                }}
                className="
                  w-full px-3 sm:px-4 py-3
                  flex items-center gap-2 sm:gap-3
                  transition-colors duration-150
                  text-left
                  border-b
                  last:border-b-0
                  cursor-pointer
                "
                style={{
                  backgroundColor: '#ffffff',
                  borderColor: 'rgba(0, 0, 0, 0.05)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 193, 7, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                }}
              >
                {/* Imagen del producto */}
                <div 
                  className="size-14 sm:size-12 rounded-lg overflow-hidden flex-shrink-0"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                  }}
                >
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={getImageUrl(product.images[0])}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://placehold.co/200x200?text=Sin+Imagen";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ color: 'rgba(0, 0, 0, 0.2)' }}>
                      <Search size={20} />
                    </div>
                  )}
                </div>

                {/* Info del producto */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm sm:text-sm line-clamp-1" style={{ color: '#000000' }}>
                    {product.name}
                  </div>
                  {product.saint_name && (
                    <div className="text-[10px] line-clamp-1" style={{ color: 'rgba(0, 0, 0, 0.48)' }}>
                      Ref: {product.saint_name}
                    </div>
                  )}
                  <div className="text-xs line-clamp-1" style={{ color: 'rgba(0, 0, 0, 0.6)' }}>
                    {[product.category_name, product.subcategory_name].filter(Boolean).join(" · ")}
                  </div>
                  {product.stock <= 0 && (
                    <div className="mt-0.5 text-[10px] font-bold text-danger">
                      Agotado · Próximo en llegar
                    </div>
                  )}
                </div>

                {/* Precio */}
                <div className="text-sm sm:text-sm font-bold text-primary flex-shrink-0">
                  ${product.price.toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Contador de resultados - solo si no es compacto */}
      {!compact && searchTerm && (
        <div className="mt-3 text-center">
          <span className="text-xs md:text-sm text-black/60 dark:text-white/60 font-medium">
            {products.filter(p => {
              const searchLower = searchTerm.toLowerCase().trim();
              return (
                p.name?.toLowerCase().includes(searchLower) ||
                p.id?.toLowerCase().includes(searchLower) ||
                p.saint_name?.toLowerCase().includes(searchLower) ||
                p.category_name?.toLowerCase().includes(searchLower) ||
                p.subcategory_name?.toLowerCase().includes(searchLower) ||
                p.description?.toLowerCase().includes(searchLower)
              );
            }).length} {" "}
            resultado{products.filter(p => {
              const searchLower = searchTerm.toLowerCase().trim();
              return (
                p.name?.toLowerCase().includes(searchLower) ||
                p.category_name?.toLowerCase().includes(searchLower) ||
                p.subcategory_name?.toLowerCase().includes(searchLower) ||
                p.description?.toLowerCase().includes(searchLower)
              );
            }).length !== 1 ? 's' : ''} encontrado{products.filter(p => {
              const searchLower = searchTerm.toLowerCase().trim();
              return (
                p.name?.toLowerCase().includes(searchLower) ||
                p.category_name?.toLowerCase().includes(searchLower) ||
                p.subcategory_name?.toLowerCase().includes(searchLower) ||
                p.description?.toLowerCase().includes(searchLower)
              );
            }).length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
