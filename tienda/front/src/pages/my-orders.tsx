import { Pagination } from "@heroui/pagination";
import { Tabs, Tab } from "@heroui/tabs";
import { useMyOrders, OrderTab } from "../hooks/useMyOrders";
import { useApp } from "../context/AppContext";
import { OrderCard, OrderDetailModal } from "../components/orders";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

export default function MyOrdersPage() {
  const { products } = useApp();
  const {
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
    getTabCounts,
    fetchMySales,
    user,
  } = useMyOrders();

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 w-full">
      <div className="bg-white dark:bg-[#0d0d0d] rounded-[2.5rem] border border-black/5 dark:border-white/5 overflow-hidden shadow-2xl shadow-black/5 p-8">
        <h3 className="text-2xl font-bold mb-6 text-black dark:text-white">Mis Pedidos</h3>
        {isMySalesLoading ? (
          <p className="opacity-50 text-black dark:text-white">Cargando pedidos...</p>
        ) : filteredSales.length === 0 ? (
          <p className="opacity-50 italic text-black dark:text-white">Aún no has realizado pedidos.</p>
        ) : (
          <>
            <Tabs
              selectedKey={activeTab}
              onSelectionChange={(key) => handleTabChange(key as OrderTab)}
              className="mb-4"
            >
              <Tab key="todos" title={`Todos (${getTabCounts.todos})`} />
              <Tab key="pagados" title={`Pagados (${getTabCounts.pagados})`} />
              <Tab key="pendientes" title={`Pendientes (${getTabCounts.pendientes})`} />
              <Tab key="cancelados" title={`Cancelados (${getTabCounts.cancelados})`} />
            </Tabs>
            {filteredSales.length === 0 ? (
              <p className="opacity-50 italic text-black dark:text-white">No hay pedidos en esta categoría.</p>
            ) : (
              <div className="flex flex-col gap-4 text-black dark:text-white">
                {paginatedMySales.map(sale => (
                  <OrderCard
                    key={sale.id}
                    sale={sale}
                    user={user}
                    getStatusClasses={getStatusClasses}
                    onViewDetails={setSelectedSaleDetail}
                    onRefresh={fetchMySales}
                  />
                ))}
              </div>
            )}
            {mySalesPages > 1 && (
              <div className="flex w-full justify-center mt-6">
                <Pagination
                  isCompact
                  showControls
                  color="primary"
                  page={mySalesCurrentPage}
                  total={mySalesPages}
                  onChange={setMySalesCurrentPage}
                  variant="light"
                />
              </div>
            )}
          </>
        )}
      </div>

      <OrderDetailModal
        sale={selectedSaleDetail}
        isOpen={!!selectedSaleDetail}
        onClose={() => setSelectedSaleDetail(null)}
        user={user}
        products={products}
        getStatusClasses={getStatusClasses}
        apiUrl={API_URL}
      />
    </div>
  );
}
