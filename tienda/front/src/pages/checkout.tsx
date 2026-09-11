import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@heroui/button";
import { DashboardLayout } from "../components/templates/DashboardLayout";
import { CategoryList } from "../components/organisms/CategoryList";
import {
  DeliveryMethodSection,
  CustomerDataSection,
  PaymentMethodSection,
  ReceiptUpload,
  OrderSummary,
  CarrierModal,
  DepartmentModal,
  CityModal,
} from "../components/checkout";
import { useCheckout } from "../hooks/useCheckout";
import { useApp } from "../context/AppContext";
import { CartSummary } from "../components/organisms/CartSummary";

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const {
    checkoutStatus,
    handleInitiateCheckout,
    removeFromCart,
    updateQuantity,
    clearCart,
  } = useApp();

  const {
    // Data
    cart,
    shippingCost,
    total,
    itemCount,
    categoriesData,
    paymentSettings,
    
    // Form states
    firstName,
    setFirstName,
    lastName,
    setLastName,
    phone,
    setPhone,
    idNumber,
    setIdNumber,
    department,
    city,
    address,
    setAddress,
    additionalInfo,
    setAdditionalInfo,
    delivery,
    setDelivery,
    carrier,
    setCarrier,
    paymentMethod,
    setPaymentMethod,
    receipts,
    setReceipts,
    
    // Modal states
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
    
    // Other states
    errors,
    isSubmitting,
    status,
    copiedNumber,
    
    // Constants
    availableCities,
    DEPARTMENTS,
    
    // Handlers
    handleCopy,
    handleFileChange,
    removeFile,
    openCarrierModal,
    confirmCarrier,
    openDepartmentModal,
    confirmDepartment,
    openCityModal,
    confirmCity,
    handleConfirm,
    navigate,
  } = useCheckout();

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
            <h1 className="text-xl font-bold">Completar pedido</h1>
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
            <div className="bg-primary/10 p-8 border-b border-black/5 dark:border-white/5 flex flex-col items-center gap-2">
              <div className="size-16 bg-primary text-white rounded-full flex items-center justify-center text-2xl shadow-xl shadow-primary/30 ring-8 ring-primary/10">
                🛍️
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Tu pedido</h2>
              <p className="text-black/40 dark:text-white/40 text-sm">
                {itemCount} producto{itemCount !== 1 ? "s" : ""} · Total:{" "}
                <span className="text-primary font-bold">${total.toLocaleString("es-CO")}</span>
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
              <CustomerDataSection
                firstName={firstName}
                lastName={lastName}
                phone={phone}
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
                onIdNumberChange={setIdNumber}
                onOpenDepartmentModal={openDepartmentModal}
                onOpenCityModal={openCityModal}
                onAddressChange={setAddress}
                onAdditionalInfoChange={setAdditionalInfo}
              />

              {/* ── Método de pago ────────────────────────────────────── */}
              <PaymentMethodSection
                paymentMethod={paymentMethod}
                copiedNumber={copiedNumber}
                bankInfo={paymentSettings.bankInfo}
                paymentTerms={paymentSettings.paymentTerms}
                errors={{ payment: errors.payment }}
                onSelectPayment={(method) => {
                  setPaymentMethod(method);
                  if (method === "Contraentrega") setReceipts([]);
                }}
                onCopyNumber={handleCopy}
              />

              {/* ── Upload de comprobantes ─────────────────────────────── */}
              {paymentMethod && paymentMethod !== "Contraentrega" && (
                <ReceiptUpload
                  receipts={receipts}
                  errors={{ receipts: errors.receipts }}
                  onFileChange={handleFileChange}
                  onRemoveFile={removeFile}
                />
              )}

              {/* ── Resumen del pedido ────────────────────────────────── */}
              <OrderSummary cart={cart} total={total} shippingCost={shippingCost} />

              {/* ── Botón confirmar ───────────────────────────────────── */}
              <Button
                className="w-full h-14 text-base font-bold bg-primary text-white rounded-2xl shadow-lg shadow-primary/30"
                onClick={handleConfirm}
                isDisabled={isSubmitting || status?.success === true}
                isLoading={isSubmitting}
              >
                {isSubmitting ? "Procesando pedido…" : "Confirmar pedido"}
              </Button>
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
