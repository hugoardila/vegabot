import React from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Category } from "../../types";

interface CategoryBarMobileProps {
  categories: string[];
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  activeSubcategory: string;
  setActiveSubcategory: (subcategory: string) => void;
  categoriesData?: Category[];
}

const categoryColors: Record<string, string> = {
  Todos: "bg-primary shadow-primary/20",
  Electrónica: "bg-blue-500 shadow-blue-500/20",
  Ropa: "bg-pink-500 shadow-pink-500/20",
  Hogar: "bg-orange-500 shadow-orange-500/20",
  Belleza: "bg-purple-500 shadow-purple-500/20",
  Deportes: "bg-green-500 shadow-green-500/20",
};

export const CategoryBarMobile: React.FC<CategoryBarMobileProps> = ({
  categories,
  activeCategory,
  setActiveCategory,
  activeSubcategory,
  setActiveSubcategory,
  categoriesData = [],
}) => {
  const activeCategoryData = categoriesData.find((category) => category.name === activeCategory);
  const activeSubcategories = activeCategoryData?.subcategories || [];

  const getIcon = (cat: string): string => {
    if (cat === "Todos") return "✨";
    return categoriesData.find((category) => category.name === cat)?.icon || "📁";
  };

  return (
    <div className="xl:hidden" data-mobile-category-bar>
      <div className="flex w-full gap-4 overflow-x-auto px-2 py-4 -mx-2 no-scrollbar scroll-smooth snap-x touch-pan-x touch-pan-y overscroll-x-contain [-webkit-overflow-scrolling:touch] transform-gpu">
        {categories.map((cat) => {
          const isActive = activeCategory === cat;
          const colorClass = categoryColors[cat] || "bg-gray-500 shadow-gray-500/20";

          return (
            <motion.button
              key={cat}
              type="button"
              whileTap={{ scale: 0.9 }}
              className="flex min-w-[70px] snap-start flex-col items-center gap-2"
              onClick={() => {
                setActiveCategory(cat);
                setActiveSubcategory("Todos");
              }}
            >
              <div
                className={`relative flex size-14 items-center justify-center rounded-full text-2xl shadow-lg transition-all duration-300 ${
                  isActive
                    ? `${colorClass} scale-110 ring-4 ring-primary/20`
                    : "bg-white dark:bg-white/5"
                }`}
              >
                {getIcon(cat)}
                {isActive && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute -bottom-1 size-2 rounded-full bg-primary"
                  />
                )}
              </div>
              <span
                className={`w-full truncate text-center text-[10px] font-bold uppercase tracking-normal ${
                  isActive ? "text-primary" : "text-black/40 dark:text-white/40"
                }`}
              >
                {cat}
              </span>
            </motion.button>
          );
        })}
      </div>

      {activeCategory !== "Todos" && activeSubcategories.length > 0 && (
        <div className="relative mb-3">
          <select
            aria-label={`Subcategorías de ${activeCategory}`}
            className="h-11 w-full appearance-none rounded-lg border border-primary/20 bg-primary/5 px-4 pr-10 text-sm font-semibold text-black outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 dark:text-white"
            value={activeSubcategory}
            onChange={(event) => setActiveSubcategory(event.target.value)}
          >
            <option value="Todos">Todos en {activeCategory}</option>
            {activeSubcategories.map((subcategory) => (
              <option key={subcategory.id} value={subcategory.id}>
                {subcategory.icon || "📦"} {subcategory.name}
                {typeof subcategory.product_count === "number" ? ` (${subcategory.product_count})` : ""}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-primary"
            size={18}
          />
        </div>
      )}
    </div>
  );
};
