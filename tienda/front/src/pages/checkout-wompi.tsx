import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@heroui/button";
import { DashboardLayout } from "../components/templates/DashboardLayout";
import { CategoryList } from "../components/organisms/CategoryList";
import {
  DeliveryMethodSection,
  CustomerDataWithEmailSection,
  CarrierModal,
  DepartmentModal,
  CityModal,
  OrderSummary,
} from "../components/checkout";
import { useCheckoutWompi } from "../hooks/useCheckoutWompi";
import { useApp } from "../context/AppContext";
import { CartSummary } from "../components/organisms/CartSummary";

export default function CheckoutWompiPage() {
  const {
    checkoutStatus,
    handleInitiateCheckout,
    removeFromCart,
    updateQuantity,
    clearCart,
  } = useApp();

  const {
    cart,
    shippingCost,
    total,
    itemCount,
    categoriesData,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    phone,
    setPhone,
    email,
    setEmail,
    idNumber,
    setIdNumber,
    address,
    setAddress,
    department,
    city,
    additionalInfo,
    setAdditionalInfo,
    delivery,
    setDelivery,
    carrier,
    setCarrier,
    pendingCarrier,
    setPendingCarrier,
    isCarrierModalOpen,
    setIsCarrierModalOpen,
    pendingDepartment,
    setPendingDepartment,
    isDepartmentModalOpen,
    setIsDepartmentModalOpen,
    departmentSearchQuery,
    setDepartmentSearchQuery,
    pendingCity,
    setPendingCity,
    isCityModalOpen,
    setIsCityModalOpen,
    citySearchQuery,
    setCitySearchQuery,
    carrierConfirmedRef,
    errors,
    isSubmitting,
    status,
    availableCities,
    DEPARTMENTS,
    handlePayWithWompi,
    openDepartmentModal,
    confirmDepartment,
    openCityModal,
    confirmCity,
    openCarrierModal,
    confirmCarrier,
    navigate,
  } = useCheckoutWompi();

  return (
    <>
      <DashboardLayout
        isAdmin={false}
        isMenuOpen={false}
        setIsMenuOpen={() => {}}
        isCartOpen={false}
        setIsCartOpen={() => {}}
        onProfileClick={() => navigate("/profile")}
        onMyOrdersClick={() => navigate("/my-orders")}
        headerContent={
          <div className="flex items-center gap-4">
            <Button
              className="bg-black/5 dark:bg-white/5 font-bold"
              size="sm"
              variant="flat"
              onClick={() => navigate(-1)}
            >
              ← Volver
            </Button>
            <h1 className="text-xl font-bold">Pagar con Wompi</h1>
          </div>
        }
        sidebarContent={
          <CategoryList
            categories={categoriesData}
            activeCategory="Todos"
            setActiveCategory={() => {}}
            isAdmin={false}
            isSuperAdmin={false}
            setIsMenuOpen={() => {}}
            isMobile={false}
            activeView="products"
            setActiveView={() => navigate("/")}
            lowStockCount={0}
            pendingOrdersCount={0}
            handleOpenProductModal={() => {}}
            setIsCategoryModalOpen={() => {}}
            onEditCategory={() => {}}
            onDeleteCategory={() => {}}
          />
        }
        cartSidebarContent={
          <CartSummary
            cart={cart}
            checkoutStatus={checkoutStatus}
            total={total}
            shippingCost={shippingCost}
            isSubmitting={isSubmitting}
            handleInitiateCheckout={handleInitiateCheckout}
            removeFromCart={removeFromCart}
            updateQuantity={updateQuantity}
            clearCart={clearCart}
            isReadOnly={true}
          />
        }
      >
        <div className="max-w-2xl mx-auto py-8 px-4">
          {/* Status banner */}
          <AnimatePresence>
            {status && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mb-6 p-4 rounded-2xl text-center font-bold text-sm ${
                  status.success ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                }`}
              >
                {status.message}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#0d0d0d] rounded-[2.5rem] border border-black/5 dark:border-white/5 overflow-hidden shadow-2xl shadow-black/5"
          >
            {/* Card header */}
            <div className="bg-[#00D4AA]/10 p-8 border-b border-black/5 dark:border-white/5 flex flex-col items-center gap-2">
              <div className="size-16 bg-[#00D4AA] text-white rounded-full flex items-center justify-center text-2xl shadow-xl shadow-[#00D4AA]/30 ring-8 ring-[#00D4AA]/10">
                💳
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Pago con Wompi</h2>
              <p className="text-black/40 dark:text-white/40 text-sm">
                {itemCount} producto{itemCount !== 1 ? "s" : ""} · Total:{" "}
                <span className="text-[#00D4AA] font-bold">${total.toLocaleString("es-CO")}</span>
              </p>
            </div>

            <div className="p-8 flex flex-col gap-8">
              {/* ── Método de entrega ─────────────────────────────────── */}
              <DeliveryMethodSection
                delivery={delivery}
                carrier={carrier}
                errors={{ delivery: errors.delivery, carrier: errors.carrier }}
                onSelectPickup={() => { setDelivery("pickup"); setCarrier(null); }}
                onSelectShipping={() => { setDelivery("shipping"); openCarrierModal(); }}
                onOpenCarrierModal={openCarrierModal}
              />

              {/* ── Datos del cliente ──────────────────────────────────── */}
              <CustomerDataWithEmailSection
                firstName={firstName}
                lastName={lastName}
                phone={phone}
                email={email}
                idNumber={idNumber}
                department={department}
                city={city}
                address={address}
                additionalInfo={additionalInfo}
                delivery={delivery}
                errors={errors}
                onFirstNameChange={setFirstName}
                onLastNameChange={setLastName}
                onPhoneChange={setPhone}
                onEmailChange={setEmail}
                onIdNumberChange={setIdNumber}
                onOpenDepartmentModal={openDepartmentModal}
                onOpenCityModal={openCityModal}
                onAddressChange={setAddress}
                onAdditionalInfoChange={setAdditionalInfo}
              />

              {/* ── Información de Wompi ──────────────────────────────── */}
              <section className="bg-gradient-to-br from-[#00D4AA]/5 to-[#00D4AA]/10 rounded-2xl p-5 border border-[#00D4AA]/20">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">ℹ️</div>
                  <div>
                    <h4 className="text-sm font-bold text-[#00D4AA] mb-2">Pago seguro con Wompi</h4>
                    <p className="text-xs text-black/60 dark:text-white/60 leading-relaxed">
                      Serás redirigido a la plataforma segura de Wompi donde podrás pagar con:
                    </p>
                    <ul className="text-xs text-black/60 dark:text-white/60 mt-2 space-y-1">
                      <li>💳 Tarjeta de crédito/débito</li>
                      <li>🏦 PSE (Pagos seguros en línea)</li>
                      <li>🏪 Efectivo (Baloto, Efecty, etc.)</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* ── Resumen del pedido ────────────────────────────────── */}
              <OrderSummary cart={cart} total={total} shippingCost={shippingCost} />

              {/* ── Botón pagar ───────────────────────────────────────── */}
              <Button
                className="w-full h-14 text-base font-bold bg-[#00D4AA] text-white rounded-2xl shadow-lg shadow-[#00D4AA]/30 hover:scale-[1.01] transition-transform"
                onClick={handlePayWithWompi}
                isDisabled={isSubmitting || status?.success === true}
                isLoading={isSubmitting}
              >
                {isSubmitting ? "Procesando..." : "Pagar con Wompi 🔒"}
              </Button>

              <p className="text-center text-[10px] text-black/40 dark:text-white/40">
                Al continuar, aceptas los términos y condiciones de Wompi
              </p>
            </div>
          </motion.div>
        </div>
      </DashboardLayout>

      {/* ── Modals ──────────────────────────── */}
      <CarrierModal
        isOpen={isCarrierModalOpen}
        onOpenChange={setIsCarrierModalOpen}
        pendingCarrier={pendingCarrier}
        carrier={carrier}
        carrierConfirmedRef={carrierConfirmedRef}
        onPendingCarrierChange={setPendingCarrier}
        onConfirm={confirmCarrier}
        onCancel={() => { if (!carrier) setDelivery(null); }}
      />

      <DepartmentModal
        isOpen={isDepartmentModalOpen}
        onOpenChange={setIsDepartmentModalOpen}
        departments={DEPARTMENTS}
        pendingDepartment={pendingDepartment}
        onPendingDepartmentChange={setPendingDepartment}
        onConfirm={confirmDepartment}
        searchQuery={departmentSearchQuery}
        onSearchQueryChange={setDepartmentSearchQuery}
      />

      <CityModal
        isOpen={isCityModalOpen}
        onOpenChange={setIsCityModalOpen}
        cities={availableCities}
        department={department}
        pendingCity={pendingCity}
        onPendingCityChange={setPendingCity}
        onConfirm={confirmCity}
        searchQuery={citySearchQuery}
        onSearchQueryChange={setCitySearchQuery}
      />
    </>
  );
}
