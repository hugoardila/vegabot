import { Product } from "../types";
import { getRetailPrice } from "./pricing";

export type StockFilterMode = "all" | "available" | "out" | "low";
export type CatalogSort = "relevance" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc" | "name_asc";

export interface CatalogFilters {
  stockMode: StockFilterMode;
  minStock: string;
  maxStock: string;
  minPrice: string;
  maxPrice: string;
  category: string;
  sort: CatalogSort;
}

export const emptyCatalogFilters: CatalogFilters = {
  stockMode: "all",
  minStock: "",
  maxStock: "",
  minPrice: "",
  maxPrice: "",
  category: "",
  sort: "relevance",
};

const stockModes: StockFilterMode[] = ["all", "available", "out", "low"];
const sorts: CatalogSort[] = ["relevance", "price_asc", "price_desc", "stock_asc", "stock_desc", "name_asc"];

export const parseCatalogFilters = (params: URLSearchParams): CatalogFilters => {
  const stockMode = params.get("stock") as StockFilterMode;
  const sort = params.get("sort") as CatalogSort;
  return {
    stockMode: stockModes.includes(stockMode) ? stockMode : "all",
    minStock: cleanNumericParam(params.get("minStock")),
    maxStock: cleanNumericParam(params.get("maxStock")),
    minPrice: cleanNumericParam(params.get("minPrice")),
    maxPrice: cleanNumericParam(params.get("maxPrice")),
    category: String(params.get("category") || "").trim(),
    sort: sorts.includes(sort) ? sort : "relevance",
  };
};

export const buildCatalogSearchParams = (query: string, filters: CatalogFilters) => {
  const params = new URLSearchParams();
  const normalizedQuery = query.trim();
  if (normalizedQuery) params.set("q", normalizedQuery);
  if (filters.stockMode !== "all") params.set("stock", filters.stockMode);
  if (filters.minStock) params.set("minStock", filters.minStock);
  if (filters.maxStock) params.set("maxStock", filters.maxStock);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  if (filters.category) params.set("category", filters.category);
  if (filters.sort !== "relevance") params.set("sort", filters.sort);
  return params;
};

export const countActiveCatalogFilters = (filters: CatalogFilters) => [
  filters.stockMode !== "all",
  Boolean(filters.minStock || filters.maxStock),
  Boolean(filters.minPrice || filters.maxPrice),
  Boolean(filters.category),
  filters.sort !== "relevance",
].filter(Boolean).length;

export const applyCatalogFilters = (products: Product[], query: string, filters: CatalogFilters) => {
  const normalizedQuery = normalizeText(query);
  const minStock = toOptionalNumber(filters.minStock);
  const maxStock = toOptionalNumber(filters.maxStock);
  const minPrice = toOptionalNumber(filters.minPrice);
  const maxPrice = toOptionalNumber(filters.maxPrice);

  const filtered = products.filter((product) => {
    const stock = Number(product.stock || 0);
    const price = getRetailPrice(product);
    if (normalizedQuery && ![
      product.name,
      product.id,
      product.saint_name,
      product.category_name,
      product.subcategory_name,
      product.description,
    ].some((value) => normalizeText(value).includes(normalizedQuery))) return false;

    if (filters.stockMode === "available" && stock <= 0) return false;
    if (filters.stockMode === "out" && stock > 0) return false;
    if (filters.stockMode === "low" && (stock <= 0 || stock > 5)) return false;
    if (minStock !== null && stock < minStock) return false;
    if (maxStock !== null && stock > maxStock) return false;
    if (minPrice !== null && price < minPrice) return false;
    if (maxPrice !== null && price > maxPrice) return false;
    if (filters.category && product.category_name !== filters.category) return false;
    return true;
  });

  return [...filtered].sort((a, b) => {
    if (filters.sort === "price_asc") return getRetailPrice(a) - getRetailPrice(b);
    if (filters.sort === "price_desc") return getRetailPrice(b) - getRetailPrice(a);
    if (filters.sort === "stock_asc") return Number(a.stock || 0) - Number(b.stock || 0);
    if (filters.sort === "stock_desc") return Number(b.stock || 0) - Number(a.stock || 0);
    if (filters.sort === "name_asc") return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    return 0;
  });
};

const normalizeText = (value: unknown) => String(value || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim();

const cleanNumericParam = (value: string | null) => {
  if (!value) return "";
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? String(Math.round(number)) : "";
};

const toOptionalNumber = (value: string) => {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(number, 0) : null;
};
