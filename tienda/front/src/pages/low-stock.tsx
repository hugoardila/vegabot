import React from "react";
import { useApp } from "../context/AppContext";
import { LowStockList } from "../components/organisms/LowStockList";

export const LowStockPage: React.FC = () => {
  const { products, handleOpenProductModal } = useApp();

  return (
    <LowStockList
      products={products}
      handleOpenProductModal={handleOpenProductModal}
    />
  );
};
