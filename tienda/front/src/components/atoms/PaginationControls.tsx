import React from "react";
import { Pagination } from "@heroui/pagination";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  variant?: "light" | "flat" | "bordered" | "faded";
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  showControls?: boolean;
  isCompact?: boolean;
}

/**
 * Componente reutilizable de controles de paginación
 * Wrapper consistente para el componente Pagination de HeroUI
 */
export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  variant = "light",
  color = "primary",
  size = "md",
  className = "",
  showControls = true,
  isCompact = true,
}) => {
  // No mostrar paginación si solo hay una página
  if (totalPages <= 1) return null;

  return (
    <div className={`flex w-full justify-center my-4 ${className}`}>
      <Pagination
        isCompact={isCompact}
        showControls={showControls}
        color={color}
        page={currentPage}
        total={totalPages}
        onChange={onPageChange}
        variant={variant}
        size={size}
      />
    </div>
  );
};
