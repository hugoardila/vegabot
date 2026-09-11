import React, { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/button";
import { Category } from "../../types";
import { PencilIcon, TrashIcon } from "../atoms/icons";
import { ChevronDown, Store } from "lucide-react";

interface CategoryListProps {
  isMobile?: boolean;
  categories: Category[];
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  activeSubcategory?: string;
  setActiveSubcategory?: (subcategory: string) => void;
  isMenuOpen?: boolean;
  setIsMenuOpen?: (isOpen: boolean) => void;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  activeView:
    | "products"
    | "orders"
    | "users"
    | "low-stock"
    | "uploads"
    | "videos"
    | "suppliers";
  setActiveView: (
    view:
      | "products"
      | "orders"
      | "users"
      | "low-stock"
      | "uploads"
      | "videos"
      | "suppliers",
  ) => void;
  lowStockCount: number;
  pendingOrdersCount: number;
  handleOpenProductModal: () => void;
  setIsCategoryModalOpen: (isOpen: boolean) => void;
  onEditCategory: (cat: Category) => void;
  onDeleteCategory: (id: string) => void;
}

export const CategoryList: React.FC<CategoryListProps> = ({
  isMobile: _isMobile = false,
  categories,
  activeCategory,
  setActiveCategory,
  activeSubcategory = "Todos",
  setActiveSubcategory = () => {},
  isMenuOpen = false,
  setIsMenuOpen,
  isAdmin,
  isSuperAdmin: _isSuperAdmin,
  activeView,
  setActiveView,
  lowStockCount,
  pendingOrdersCount,
  handleOpenProductModal,
  setIsCategoryModalOpen,
  onEditCategory,
  onDeleteCategory,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const activeItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeCategory === "Todos") return;
    const category = categories.find((item) => item.name === activeCategory);
    if (!category?.subcategories?.length) return;
    setExpandedCategories((current) => {
      if (current.has(category.id)) return current;
      return new Set([...current, category.id]);
    });
  }, [activeCategory, categories]);

  useEffect(() => {
    if (!isMenuOpen) return;

    let firstFrame = 0;
    let secondFrame = 0;
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const activeItem = activeItemRef.current;
        const scrollContainer = activeItem?.closest(
          "[data-category-scroll-container]",
        ) as HTMLElement | null;
        if (!activeItem || !scrollContainer) return;

        const itemRect = activeItem.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        const centeredTop = scrollContainer.scrollTop
          + itemRect.top
          - containerRect.top
          - Math.max((scrollContainer.clientHeight - itemRect.height) / 2, 0);
        const maximumTop = Math.max(
          scrollContainer.scrollHeight - scrollContainer.clientHeight,
          0,
        );

        scrollContainer.scrollTo({
          top: Math.min(Math.max(centeredTop, 0), maximumTop),
          behavior: "auto",
        });
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [activeCategory, activeSubcategory, categories, expandedCategories, isMenuOpen]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  return (
  <nav className="flex flex-col gap-1">
    {isAdmin && (
      <div className="mb-6 flex flex-col gap-1">
        <p className="text-[10px] uppercase font-bold text-black/40 dark:text-white/40 mb-2 px-2 tracking-widest">
          Panel de Control
        </p>
        <button
          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 ${
            activeView === "products"
              ? "bg-primary text-white font-medium shadow-lg shadow-primary/20"
              : "text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
          }`}
          onClick={() => {
            setActiveView("products");
            if (setIsMenuOpen) setIsMenuOpen(false);
          }}
        >
          📦 Catálogo de Productos
        </button>

        <button
          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 ${
            activeView === "low-stock"
              ? "bg-danger text-white font-medium shadow-lg shadow-danger/20"
              : "text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
          }`}
          onClick={() => {
            setActiveView("low-stock");
            if (setIsMenuOpen) setIsMenuOpen(false);
          }}
        >
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-3">📉 Reponer Stock</span>
            {lowStockCount > 0 && (
              <span className="bg-white text-danger text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center ml-2 border border-black/5">
                {lowStockCount}
              </span>
            )}
          </div>
        </button>

        <button
          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 ${
            activeView === "orders"
              ? "bg-primary text-white font-medium shadow-lg shadow-primary/20"
              : "text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
          }`}
          onClick={() => {
            setActiveView("orders");
            if (setIsMenuOpen) setIsMenuOpen(false);
          }}
        >
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-3">📋 Pedidos de Clientes</span>
            {pendingOrdersCount > 0 && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center ml-2 border border-black/5 ${activeView === "orders" ? "bg-white text-danger" : "bg-danger text-white"}`}>
                {pendingOrdersCount}
              </span>
            )}
          </div>
        </button>

        <button
          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 ${
            activeView === "uploads"
              ? "bg-primary text-white font-medium shadow-lg shadow-primary/20"
              : "text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
          }`}
          onClick={() => {
            setActiveView("uploads");
            if (setIsMenuOpen) setIsMenuOpen(false);
          }}
        >
          🗂️ Panel de Archivos
        </button>

        <button
          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 ${
            activeView === "users"
              ? "bg-primary text-white font-medium shadow-lg shadow-primary/20"
              : "text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
          }`}
          onClick={() => {
            setActiveView("users");
            if (setIsMenuOpen) setIsMenuOpen(false);
          }}
        >
          👥 Gestión de Usuarios
        </button>
      </div>
    )}

    {/* Visible para todos los usuarios */}
    <button
      ref={activeCategory === "Todos" ? activeItemRef : undefined}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 ${
        activeView === "suppliers"
          ? "bg-primary text-white font-medium shadow-lg shadow-primary/20"
          : "text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
      }`}
      onClick={() => {
        setActiveView("suppliers");
        if (setIsMenuOpen) setIsMenuOpen(false);
      }}
    >
      <Store size={17} />
      Distribuidores
    </button>



    <button
      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 ${
        activeView === "videos"
          ? "bg-primary text-white font-medium shadow-lg shadow-primary/20"
          : "text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
      }`}
      onClick={() => {
        setActiveView("videos");
        if (setIsMenuOpen) setIsMenuOpen(false);
      }}
    >
      🎬 Videos
    </button>

    <p className="text-[10px] uppercase font-bold text-black/40 dark:text-white/40 mb-2 px-2 tracking-widest">
      Categorías
    </p>

    {/* All Categories Option */}
    <button
      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 ${
        activeCategory === "Todos"
          ? "bg-black/10 dark:bg-white/10 text-black dark:text-white font-medium shadow-sm"
          : "text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
      }`}
      onClick={() => {
        setActiveCategory("Todos");
        setActiveSubcategory("Todos");
        setActiveView("products");
        if (setIsMenuOpen) setIsMenuOpen(false);
      }}
    >
      📂 Todos
    </button>

    {categories.map((cat) => {
      const subcategories = cat.subcategories || [];
      const isExpanded = expandedCategories.has(cat.id);
      const isCategoryActive = activeCategory === cat.name;

      return (
        <div key={cat.id} className="group">
          <div
            className={`flex items-center rounded-lg transition-colors ${
              isCategoryActive
                ? "bg-black/10 text-black shadow-sm dark:bg-white/10 dark:text-white"
                : "text-black/50 hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white"
            }`}
          >
            <button
              ref={isCategoryActive && activeSubcategory === "Todos" ? activeItemRef : undefined}
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left text-sm"
              onClick={() => {
                setActiveCategory(cat.name);
                setActiveSubcategory("Todos");
                setActiveView("products");
                if (subcategories.length) {
                  setExpandedCategories((current) => new Set([...current, cat.id]));
                } else if (setIsMenuOpen) {
                  setIsMenuOpen(false);
                }
              }}
            >
              <span className="shrink-0 text-base leading-none">{cat.icon || "📁"}</span>
              <span className="truncate">{cat.name}</span>
            </button>

            {subcategories.length > 0 && (
              <button
                type="button"
                aria-label={`${isExpanded ? "Ocultar" : "Mostrar"} subcategorías de ${cat.name}`}
                aria-expanded={isExpanded}
                className="mr-1 flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-black/10 dark:hover:bg-white/10"
                onClick={() => toggleCategory(cat.id)}
              >
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>
            )}

            {isAdmin && (
              <div className="mr-1 flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => onEditCategory(cat)}
                  className="rounded-md p-1.5 text-primary transition-colors hover:bg-primary/10"
                  title="Editar categoría y subcategorías"
                >
                  <PencilIcon size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteCategory(cat.id)}
                  className="rounded-md p-1.5 text-danger transition-colors hover:bg-danger/10"
                  title="Eliminar categoría"
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            )}
          </div>

          {subcategories.length > 0 && (
            <div
              aria-hidden={!isExpanded}
              className={`grid transition-all duration-200 ${
                isExpanded
                  ? "grid-rows-[1fr] opacity-100"
                  : "pointer-events-none grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="ml-6 mt-1 flex flex-col gap-0.5 border-l border-black/10 pl-2 dark:border-white/10">
                  {subcategories.map((subcategory) => (
                    <button
                      ref={activeSubcategory === subcategory.id ? activeItemRef : undefined}
                      key={subcategory.id}
                      type="button"
                      tabIndex={isExpanded ? 0 : -1}
                      className={`flex items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors ${
                        activeSubcategory === subcategory.id
                          ? "bg-primary/10 font-semibold text-primary"
                          : "text-black/50 hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white"
                      }`}
                      onClick={() => {
                        setActiveCategory(cat.name);
                        setActiveSubcategory(subcategory.id);
                        setActiveView("products");
                        if (setIsMenuOpen) setIsMenuOpen(false);
                      }}
                    >
                      <span className="shrink-0">{subcategory.icon || "📦"}</span>
                      <span className="min-w-0 flex-1 truncate">{subcategory.name}</span>
                      {typeof subcategory.product_count === "number" && (
                        <span className="shrink-0 text-[10px] opacity-60">{subcategory.product_count}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    })}

    {isAdmin && (
      <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 flex flex-col gap-2">
        <p className="text-[10px] uppercase font-bold text-primary mb-1 px-2">
          Gestión
        </p>
        <Button
          className="justify-start gap-3 px-3 py-2 h-10 bg-primary/10 text-primary font-bold text-xs"
          variant="flat"
          onClick={() => handleOpenProductModal()}
        >
          + Nuevo Producto
        </Button>
        <Button
          className="justify-start gap-3 px-3 py-2 h-10 bg-primary/10 text-primary font-bold text-xs"
          variant="flat"
          onClick={() => setIsCategoryModalOpen(true)}
        >
          + Nueva Categoría
        </Button>
      </div>
    )}
  </nav>
  );
};
