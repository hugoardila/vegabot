import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@heroui/button";
import { DashboardLayout } from "../components/templates/DashboardLayout";
import { API_URL } from "../config/api";
import { useApp } from "../context/AppContext";

interface PaymentInfo {
  id: string;
  status: string;
  reference: string;
  amount?: number;
  currency?: string;
  paymentMethod?: string;
  customerName?: string;
  customerEmail?: string;
  createdAt?: string;
}

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useApp();
  const clearCartRef = useRef(clearCart);
  clearCartRef.current = clearCart;
  const [status, setStatus] = useState<'loading' | 'pending' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const paymentQuery = searchParams.toString();

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const paymentParams = new URLSearchParams(paymentQuery);
    const transactionId = paymentParams.get('id');
    const urlStatus = String(paymentParams.get('status') || 'PENDING').toUpperCase();
    const reference = paymentParams.get('reference') || 'N/A';

    if (!transactionId) {
      setStatus('error');
      setMessage('No se recibió un identificador de transacción válido.');
      return () => undefined;
    }

    const initialData: PaymentInfo = {
      id: transactionId,
      status: urlStatus,
      reference,
    };
    setPaymentInfo(initialData);

    const verifyPayment = async (attempt = 0): Promise<void> => {
      try {
        const response = await fetch(`${API_URL}/wompi/verify-transaction/${encodeURIComponent(transactionId)}`);
        const responseBody = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(responseBody?.error || `Wompi respondió ${response.status}`);

        const data = responseBody?.data || responseBody;
        const paymentStatus = String(data?.status || urlStatus || 'PENDING').toUpperCase();
        const paymentMethod = typeof data?.payment_method === 'string'
          ? data.payment_method
          : data?.payment_method?.type || data?.payment_method_type;
        const updatedPaymentInfo: PaymentInfo = {
          ...initialData,
          status: paymentStatus,
          reference: data?.reference || reference,
          amount: Number.isFinite(Number(data?.amount_in_cents))
            ? Number(data.amount_in_cents) / 100
            : undefined,
          currency: data?.currency,
          paymentMethod,
          createdAt: data?.created_at,
        };
        if (cancelled) return;
        setPaymentInfo(updatedPaymentInfo);

        if (paymentStatus === 'APPROVED') {
          clearCartRef.current();
          localStorage.removeItem("pos_cart");
          setStatus('success');
          setMessage('¡Pago procesado exitosamente!');
          return;
        }
        if (['DECLINED', 'VOIDED', 'ERROR'].includes(paymentStatus)) {
          setStatus('error');
          setMessage(data?.status_message || 'El pago no fue aprobado. Intenta nuevamente o usa otro método de pago.');
          return;
        }
        if (paymentStatus === 'PENDING' && attempt < 20) {
          setStatus('loading');
          setMessage('Wompi está confirmando el pago. Esta página se actualizará automáticamente.');
          retryTimer = setTimeout(() => void verifyPayment(attempt + 1), 3000);
          return;
        }

        setStatus('pending');
        setMessage('El pago fue recibido y continúa en confirmación. Puedes consultar su estado en Mis pedidos.');
      } catch (error) {
        if (cancelled) return;
        if (attempt < 3) {
          retryTimer = setTimeout(() => void verifyPayment(attempt + 1), 3000);
          return;
        }
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'No se pudo verificar el pago.');
      }
    };

    void verifyPayment();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [paymentQuery]);

  return (
    <DashboardLayout
      isAdmin={false}
      isMenuOpen={false} setIsMenuOpen={() => {}}
      isCartOpen={false} setIsCartOpen={() => {}}
      headerContent={
        <div className="flex items-center gap-4">
          <Button
            className="bg-black/5 dark:bg-white/5 font-bold"
            size="sm"
            variant="flat"
            onClick={() => navigate('/')}
          >
            ← Inicio
          </Button>
          <h1 className="text-xl font-bold">Resultado del Pago</h1>
        </div>
      }
      sidebarContent={<div className="p-4 text-xs opacity-50 italic">Cargando navegación...</div>}
      cartSidebarContent={null}
    >
      <div className="max-w-2xl mx-auto py-8 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#0d0d0d] rounded-[2.5rem] border border-black/5 dark:border-white/5 overflow-hidden shadow-2xl shadow-black/5"
        >
          <div className="p-8 text-center">
            {status === 'loading' && (
              <>
                <div className="size-16 bg-blue-500 text-white rounded-full flex items-center justify-center text-2xl mx-auto mb-4 animate-pulse">
                  ⏳
                </div>
                <h2 className="text-2xl font-bold mb-4">Verificando pago...</h2>
                <p className="text-black/60 dark:text-white/60">
                  {message || 'Por favor espera mientras verificamos el estado de tu pago.'}
                </p>
              </>
            )}

            {status === 'pending' && (
              <>
                <div className="size-16 bg-amber-500 text-white rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
                  ⏳
                </div>
                <h2 className="text-2xl font-bold mb-4 text-amber-600">Pago en confirmación</h2>
                <p className="text-black/60 dark:text-white/60 mb-6">{message}</p>
                {paymentInfo && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-5 mb-6 text-left text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="opacity-60">ID de Transacción:</span>
                      <span className="font-mono break-all text-right">{paymentInfo.id}</span>
                    </div>
                  </div>
                )}
                <div className="flex gap-3 justify-center">
                  <Button className="bg-amber-500 text-white" onClick={() => navigate('/', { state: { activeView: 'my-orders' } })}>
                    Ver mis pedidos
                  </Button>
                  <Button variant="flat" onClick={() => navigate('/')}>Volver a la tienda</Button>
                </div>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="size-16 bg-green-500 text-white rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
                  ✅
                </div>
                <h2 className="text-2xl font-bold mb-4 text-green-600">¡Pago Exitoso!</h2>
                <p className="text-black/60 dark:text-white/60 mb-6">
                  {message}
                </p>

                {/* Información del pago */}
                {paymentInfo && (
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-6 mb-6 text-left">
                    <h3 className="font-bold text-green-700 dark:text-green-300 mb-4">
                      📋 Información de la Transacción
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-black/60 dark:text-white/60">ID de Transacción:</span>
                        <span className="font-mono text-green-600 dark:text-green-400">
                          {paymentInfo.id}
                        </span>
                      </div>
                      {paymentInfo.reference && paymentInfo.reference !== 'N/A' && (
                        <div className="flex justify-between">
                          <span className="text-black/60 dark:text-white/60">Referencia:</span>
                          <span className="font-mono">{paymentInfo.reference}</span>
                        </div>
                      )}
                      {paymentInfo.amount && (
                        <div className="flex justify-between">
                          <span className="text-black/60 dark:text-white/60">Monto:</span>
                          <span className="font-bold text-green-600 dark:text-green-400">
                            ${paymentInfo.amount.toLocaleString()} {paymentInfo.currency || 'COP'}
                          </span>
                        </div>
                      )}
                      {paymentInfo.paymentMethod && (
                        <div className="flex justify-between">
                          <span className="text-black/60 dark:text-white/60">Método de Pago:</span>
                          <span>{paymentInfo.paymentMethod}</span>
                        </div>
                      )}
                      {paymentInfo.createdAt && (
                        <div className="flex justify-between">
                          <span className="text-black/60 dark:text-white/60">Fecha:</span>
                          <span>{new Date(paymentInfo.createdAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-4 justify-center">
                  <Button
                    className="bg-green-500 text-white"
                    onClick={() => navigate('/', { state: { activeView: 'my-orders' } })}
                  >
                    Ver mis pedidos
                  </Button>
                  <Button
                    variant="flat"
                    onClick={() => navigate('/')}
                  >
                    Continuar comprando
                  </Button>
                </div>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="size-16 bg-red-500 text-white rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
                  ❌
                </div>
                <h2 className="text-2xl font-bold mb-4 text-red-600">Error en el Pago</h2>
                <p className="text-black/60 dark:text-white/60 mb-6">
                  {message}
                </p>

                {/* Información del pago fallido */}
                {paymentInfo && (
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 mb-6 text-left">
                    <h3 className="font-bold text-red-700 dark:text-red-300 mb-4">
                      📋 Información de la Transacción
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-black/60 dark:text-white/60">ID de Transacción:</span>
                        <span className="font-mono text-red-600 dark:text-red-400">
                          {paymentInfo.id}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-black/60 dark:text-white/60">Estado:</span>
                        <span className="font-bold text-red-600 dark:text-red-400">
                          {paymentInfo.status}
                        </span>
                      </div>
                      {paymentInfo.reference && paymentInfo.reference !== 'N/A' && (
                        <div className="flex justify-between">
                          <span className="text-black/60 dark:text-white/60">Referencia:</span>
                          <span className="font-mono">{paymentInfo.reference}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-4 justify-center">
                  <Button
                    className="bg-blue-500 text-white"
                    onClick={() => navigate('/checkout')}
                  >
                    Intentar de nuevo
                  </Button>
                  <Button
                    variant="flat"
                    onClick={() => navigate('/')}
                  >
                    Volver al inicio
                  </Button>
                </div>
              </>
            )}
          </div>

        </motion.div>
      </div>
    </DashboardLayout>
  );
}
