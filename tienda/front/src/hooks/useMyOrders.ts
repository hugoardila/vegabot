import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/auth";
import { Sale } from "../types";

export type OrderTab = "todos" | "pagados" | "cancelados" | "pendientes";

const PAID_STATUSES = ["PAGADO", "PAID", "COMPLETADO", "ENTREGADO", "ACEPTADO", "ENVIADO"];
const PENDING_STATUSES = ["PENDIENTE", "PENDING", "EN_REVISION"];

export function useMyOrders() {
  const { token, user } = useAuth();
  const [mySales, setMySales] = useState<Sale[]>([]);
  const [isMySalesLoading, setIsMySalesLoading] = useState(false);
  const [mySalesCurrentPage, setMySalesCurrentPage] = useState(1);
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);
  const [activeTab, setActiveTab] = useState<OrderTab>("todos");
  
  const mySalesItemsPerPage = 5;
  const mySalesPages = Math.ceil(mySales.length / mySalesItemsPerPage) || 1;

  const filteredSales = useMemo(() => {
    switch (activeTab) {
      case "pagados":
        return mySales.filter(s => PAID_STATUSES.includes(s.status?.toUpperCase()));
      case "cancelados":
        return mySales.filter(s => s.status?.toUpperCase() === "CANCELADO");
      case "pendientes":
        return mySales.filter(s => PENDING_STATUSES.includes(s.status?.toUpperCase()));
      default:
        return mySales;
    }
  }, [mySales, activeTab]);

  const paginatedMySales = useMemo(() => {
    const start = (mySalesCurrentPage - 1) * mySalesItemsPerPage;
    return filteredSales.slice(start, start + mySalesItemsPerPage);
  }, [mySalesCurrentPage, filteredSales]);

  const fetchMySales = useCallback(async () => {
    if (!token) return;
    setIsMySalesLoading(true);
    try {
      const data = await authService.getMySales(token);
      setMySales(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsMySalesLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token && user) {
      fetchMySales();
    }
  }, [token, user, fetchMySales]);

  const handleTabChange = useCallback((key: OrderTab) => {
    setActiveTab(key);
    setMySalesCurrentPage(1);
  }, []);

  const getStatusClasses = useCallback((status: string) => {
    switch (status.toUpperCase()) {
      case "PENDIENTE":   return "bg-warning/10 text-warning border-warning/20";
      case "EN_REVISION": return "bg-secondary/10 text-secondary border-secondary/20";
      case "ACEPTADO":    return "bg-success/10 text-success border-success/20";
      case "ENVIADO":     return "bg-primary/10 text-primary border-primary/20";
      case "CANCELADO":   return "bg-danger/10 text-danger border-danger/20";
      case "PAGADO":
      case "COMPLETADO":
      case "ENTREGADO":   return "bg-success/10 text-success border-success/20";
      default:            return "bg-primary/10 text-primary border-primary/20";
    }
  }, []);

  const getStatusLabel = useCallback((status: string) => {
    const labels: Record<string, string> = {
      PENDIENTE:   "PENDIENTE",
      EN_REVISION: "EN REVISIÓN",
      ACEPTADO:    "ACEPTADO",
      ENVIADO:     "ENVIADO",
      CANCELADO:   "CANCELADO",
    };
    return labels[status] || status;
  }, []);

  const getTabCounts = useMemo(() => ({
    todos: mySales.length,
    pagados: mySales.filter(s => PAID_STATUSES.includes(s.status?.toUpperCase())).length,
    pendientes: mySales.filter(s => PENDING_STATUSES.includes(s.status?.toUpperCase())).length,
    cancelados: mySales.filter(s => s.status?.toUpperCase() === "CANCELADO").length,
  }), [mySales]);

  return {
    mySales,
    isMySalesLoading,
    mySalesCurrentPage,
    setMySalesCurrentPage,
    mySalesPages,
    selectedSaleDetail,
    setSelectedSaleDetail,
    activeTab,
    handleTabChange,
    filteredSales,
    paginatedMySales,
    getStatusClasses,
    getStatusLabel,
    getTabCounts,
    fetchMySales,
    user,
  };
}
