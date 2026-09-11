import React, { useState, useMemo } from "react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Pagination } from "@heroui/pagination";
import { Product } from "../../types";
import { formatPrice } from "../../utils/format";

interface LowStockListProps {
  products: Product[];
  handleOpenProductModal: (product: Product) => void;
}

export const LowStockList: React.FC<LowStockListProps> = ({ products, handleOpenProductModal }) => {
  const lowStockProducts = products.filter(p => p.stock <= 3);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const totalPages = Math.ceil(lowStockProducts.length / ITEMS_PER_PAGE) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return lowStockProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [lowStockProducts, currentPage]);

  return (
    <div className="flex flex-col gap-4">
      <div className="mb-6">
        <h2 className="text-2xl lg:text-3xl font-bold mb-1 text-danger">📉 Reponer Stock</h2>
        <p className="text-black/40 dark:text-white/40 text-xs">Productos con existencias críticas (3 o menos).</p>
      </div>

      <Table 
        aria-label="Tabla de productos con bajo stock"
        className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm"
      >
        <TableHeader>
          <TableColumn>PRODUCTO</TableColumn>
          <TableColumn>CATEGORÍA</TableColumn>
          <TableColumn>PRECIO</TableColumn>
          <TableColumn>STOCK ACTUAL</TableColumn>
          <TableColumn align="center">ACCIONES</TableColumn>
        </TableHeader>
        <TableBody emptyContent={"No hay productos con bajo stock. ¡Excelente!"}>
          {paginated.map((product) => (
            <TableRow key={product.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-bold">{product.name}</span>
                  <span className="text-[10px] opacity-40 italic">ID: #{product.id}</span>
                </div>
              </TableCell>
              <TableCell>
                <Chip size="sm" variant="flat" className="capitalize">
                  {product.category_name}
                </Chip>
              </TableCell>
              <TableCell>
                <span className="font-bold">${formatPrice(product.price)}</span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Chip 
                    color={product.stock === 0 ? "danger" : "warning"} 
                    variant="flat" 
                    size="sm" 
                    className="font-bold"
                  >
                    {product.stock} unidades
                  </Chip>
                  {product.stock === 0 && (
                    <span className="animate-pulse size-2 rounded-full bg-danger" />
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Button 
                  size="sm" 
                  color="primary" 
                  variant="flat" 
                  className="font-bold"
                  onClick={() => handleOpenProductModal(product)}
                >
                  Reponer / Editar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex w-full justify-center mt-2">
          <Pagination
            isCompact
            showControls
            color="primary"
            page={currentPage}
            total={totalPages}
            onChange={setCurrentPage}
            variant="light"
          />
        </div>
      )}
    </div>
  );
};
