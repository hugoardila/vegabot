import React from "react";
import { useApp } from "../context/AppContext";
import { OrdersList } from "../components/organisms/OrdersList";

export const OrdersPage: React.FC = () => {
  const { sales, isSalesLoading, handleUpdateStatus } = useApp();

  return (
    <OrdersList
      sales={sales}
      isLoading={isSalesLoading}
      onUpdateStatus={handleUpdateStatus}
    />
  );
};
