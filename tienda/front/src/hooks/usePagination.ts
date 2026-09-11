import { useState, useMemo, useEffect } from "react";

/**
 * Hook reutilizable para implementar paginación en cualquier lista de datos
 * @param items - Array de elementos a paginar
 * @param itemsPerPage - Número de elementos por página (default: 12)
 * @param dependencies - Array de dependencias que resetean la página a 1
 * @returns Objeto con datos paginados y funciones de control
 */
export function usePagination<T>(
  items: T[],
  itemsPerPage: number = 12,
  dependencies: any[] = []
) {
  const [currentPage, setCurrentPage] = useState(1);

  // Calcular número total de páginas
  const pages = Math.ceil(items.length / itemsPerPage) || 1;

  // Obtener elementos paginados
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  }, [items, currentPage, itemsPerPage]);

  // Resetear a página 1 cuando cambian las dependencias
  useEffect(() => {
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  // Validar que la página actual no exceda el total de páginas
  useEffect(() => {
    if (currentPage > pages && pages > 0) {
      setCurrentPage(pages);
    }
  }, [currentPage, pages]);

  return {
    currentPage,
    setCurrentPage,
    pages,
    paginatedItems,
    totalItems: items.length,
    hasNextPage: currentPage < pages,
    hasPreviousPage: currentPage > 1,
    goToFirstPage: () => setCurrentPage(1),
    goToLastPage: () => setCurrentPage(pages),
    goToNextPage: () => setCurrentPage(prev => Math.min(prev + 1, pages)),
    goToPreviousPage: () => setCurrentPage(prev => Math.max(prev - 1, 1)),
  };
}
