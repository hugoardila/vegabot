import { useEffect, useState, lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";

import LoginPage from "./pages/login";
import { ProductsPage } from "./pages/products";

// Lazy loaded components (Default exports)
const CheckoutPage = lazy(() => import("./pages/checkout"));
const CheckoutWompiPage = lazy(() => import("./pages/checkout-wompi"));
const PaymentResultPage = lazy(() => import("./pages/payment-result"));
const ResetPasswordPage = lazy(() => import("./pages/reset-password"));
const RoulettePage = lazy(() => import("./pages/roulette"));
const SuppliersPage = lazy(() => import("./pages/suppliers"));
const ProductDetailPage = lazy(() => import("./pages/product"));
const ProfilePage = lazy(() => import("./pages/profile"));
const MyOrdersPage = lazy(() => import("./pages/my-orders"));
const UploadsDashboardPage = lazy(() => import("./pages/uploads-dashboard"));
const VideosPage = lazy(() => import("./pages/videos"));

// Lazy loaded components (Named exports)
const SearchResultsPage = lazy(() => import("./pages/search-results").then(module => ({ default: module.SearchResultsPage })));
const OrdersPage = lazy(() => import("./pages/orders").then(module => ({ default: module.OrdersPage })));
const UsersPage = lazy(() => import("./pages/users").then(module => ({ default: module.UsersPage })));
const LowStockPage = lazy(() => import("./pages/low-stock").then(module => ({ default: module.LowStockPage })));

import { MainLayout } from "./components/templates/MainLayout";
import { ProtectedRoute } from "./components/atoms/ProtectedRoute";
import { API_URL } from "./config/api";

const PageFallback = () => (
  <div className="w-full h-screen flex items-center justify-center bg-black/5 dark:bg-zinc-950">
    <Spinner size="lg" color="primary" label="Cargando..." />
  </div>
);

function App() {
  const [serverDown, setServerDown] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/categories`)
      .then((res) => {
        if (!res.ok) throw new Error("Offline");
        setServerDown(false);
      })
      .catch(() => {
        setServerDown(true);
      })
      .finally(() => {
        setIsChecking(false);
      });
  }, []);

  if (isChecking) {
    return <div className="w-full h-screen bg-black/5 dark:bg-zinc-950"></div>;
  }

  if (serverDown) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-black/5 dark:bg-zinc-950 p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-danger/20 rounded-full blur-3xl opacity-50 mix-blend-screen animate-pulse pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl opacity-50 mix-blend-screen animate-pulse pointer-events-none" style={{ animationDelay: "1s" }}></div>
        
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative z-10 flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-danger/10 flex items-center justify-center ring-4 ring-danger/5 mb-4">
            <svg className="w-10 h-10 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black bg-gradient-to-br from-black to-black/60 dark:from-white dark:to-white/60 bg-clip-text text-transparent">
            Servidor en Mantenimiento
          </h1>
          <p className="text-black/60 dark:text-white/60 font-medium">
            Estamos realizando mejoras en el sistema. Intente de nuevo más tarde.
          </p>
          <Button 
            className="w-full bg-black dark:bg-white text-white dark:text-black font-bold h-12 shadow-xl shadow-black/20 dark:shadow-white/10 hover:scale-[1.02] transition-transform mt-4" 
            variant="shadow" 
            onClick={() => window.location.reload()}
          >
            Reconectar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<LoginPage />} path="/login" />
        <Route element={<ResetPasswordPage />} path="/reset-password" />
        
        {/* Rutas con MainLayout (nuevas) */}
        <Route path="/" element={
          <MainLayout>
            <ProductsPage />
          </MainLayout>
        } />
        
        <Route path="/search" element={
          <MainLayout>
            <SearchResultsPage />
          </MainLayout>
        } />
        
        <Route path="/orders" element={
          <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
            <MainLayout>
              <OrdersPage />
            </MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/users" element={
          <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
            <MainLayout>
              <UsersPage />
            </MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/low-stock" element={
          <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
            <MainLayout>
              <LowStockPage />
            </MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/profile" element={
          <ProtectedRoute>
            <MainLayout>
              <ProfilePage />
            </MainLayout>
          </ProtectedRoute>
        } />
        <Route path="/my-orders" element={
          <ProtectedRoute>
            <MainLayout>
              <MyOrdersPage />
            </MainLayout>
          </ProtectedRoute>
        } />
        <Route path="/distributors" element={
          <MainLayout>
            <SuppliersPage />
          </MainLayout>
        } />
        <Route path="/suppliers" element={
          <MainLayout>
            <SuppliersPage />
          </MainLayout>
        } />


        <Route
          path="/uploads"
          element={
            <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
              <MainLayout>
                <UploadsDashboardPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/videos"
          element={
            <MainLayout>
              <VideosPage />
            </MainLayout>
          }
        />
        
        <Route path="/product/:id" element={
          <MainLayout>
            <ProductDetailPage />
          </MainLayout>
        } />
        <Route element={<RoulettePage />} path="/roulette" />
        
        {/* Protected Routes */}
        <Route path="/checkout" element={
          <ProtectedRoute>
            <CheckoutPage />
          </ProtectedRoute>
        } />
        <Route path="/checkout-wompi" element={
          <ProtectedRoute>
            <CheckoutWompiPage />
          </ProtectedRoute>
        } />
        <Route path="/payment-result" element={
          <ProtectedRoute>
            <PaymentResultPage />
          </ProtectedRoute>
        } />
      </Routes>
    </Suspense>
  );
}

export default App;
