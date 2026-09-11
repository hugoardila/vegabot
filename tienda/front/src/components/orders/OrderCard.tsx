import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Sale } from "../../types";
import { User } from "../../types";
import { WhatsAppIcon } from "../atoms/icons";
import { WHATSAPP_SUPPORT_NUMBER } from "../../config/api";
import { PaymentCountdownBanner } from "./PaymentCountdownBanner";

interface OrderCardProps {
  sale: Sale;
  user: User | null;
  getStatusClasses: (status: string) => string;
  onViewDetails: (sale: Sale) => void;
  onRefresh?: () => void;
}

const getPaymentMethodBadge = (paymentMethod: string) => {
  const method = paymentMethod?.toLowerCase() || '';
  if (method.includes('wompi') || method.includes('tarjeta') || method.includes('pse')) {
    return { label: 'Wompi', icon: '💳', color: 'secondary' as const };
  }
  if (method.includes('contraentrega')) {
    return { label: 'Contraentrega', icon: '$', color: 'warning' as const };
  }
  return { label: 'Pago directo', icon: '💵', color: 'success' as const };
};

const PENDING_WOMPI_STATUSES = ["PENDIENTE", "PENDING"];

export function OrderCard({ sale, user, getStatusClasses: _getStatusClasses, onViewDetails, onRefresh }: OrderCardProps) {
  const itemsText = sale.items?.map((item: any) => `${item.quantity}x ${item.product_name}`).join(', ');
  const paymentBadge = getPaymentMethodBadge(sale.payment_method);

  const isPending = PENDING_WOMPI_STATUSES.includes(sale.status?.toUpperCase());
  const isWompi = sale.payment_method?.toLowerCase().includes('wompi') ||
                  sale.payment_method?.toLowerCase().includes('tarjeta') ||
                  sale.payment_method?.toLowerCase().includes('pse');
  const showCountdown = isPending && isWompi;

  return (
    <div
      className={`p-4 rounded-2xl flex flex-col gap-3 border transition-all duration-300 ${
        isPending
          ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/60 shadow-md shadow-amber-200/50 dark:shadow-amber-900/20"
          : "bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5"
      }`}
    >
      {/* Encabezado del estado PENDIENTE */}
      {isPending && (
        <div className="flex items-center gap-2 -mb-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700/50 px-2.5 py-1 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            Pago pendiente
          </span>
        </div>
      )}

      <div>
        <p className="font-bold flex items-center gap-2">Pedido</p>
        <p className="text-xs opacity-50">{new Date(sale.created_at).toLocaleString()}</p>
        <div className="text-xs mt-2 opacity-70">{itemsText}</div>
      </div>

      {/* Método de pago */}
      <div className="flex items-center gap-2">
        <span className="text-xs opacity-60 font-bold">Método de pago:</span>
        <Chip
          size="sm"
          color={paymentBadge.color}
          variant="flat"
          className="font-bold text-[10px] uppercase tracking-wider"
          startContent={<span className="text-sm">{paymentBadge.icon}</span>}
        >
          {paymentBadge.label}
        </Chip>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-primary text-lg whitespace-nowrap">
          ${sale.total_amount?.toLocaleString() || 0}
        </span>
        <Button
          size="sm"
          variant="flat"
          className="bg-black/5 dark:bg-white/5 font-bold text-xs"
          onPress={() => onViewDetails(sale)}
        >
          Ver Detalles
        </Button>
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          className="bg-black/5 dark:bg-white/5"
          onPress={() => navigator.clipboard.writeText(sale.id)}
          title="Copiar número de pedido"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
          </svg>
        </Button>
        <a
          href={`https://wa.me/${WHATSAPP_SUPPORT_NUMBER}?text=${encodeURIComponent(
            `¡Hola! Soy *${user?.full_name || 'Cliente'}*.\n\n` +
            `Tengo una consulta sobre mi pedido por *$${sale.total_amount?.toLocaleString() || 0}*.\n\n` +
            `📧 Email: ${user?.email || 'N/A'}\n` +
            `📱 Teléfono: ${(user as any)?.phone || 'N/A'}\n\n` +
            `📅 Fecha: ${new Date(sale.created_at).toLocaleDateString()}\n` +
            `🛒 Productos: ${itemsText}\n` +
            `💳 Método de pago: ${sale.payment_method}\n\n` +
            `Estado actual: *${sale.status}*`
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
          title="Contactar soporte por WhatsApp"
        >
          <WhatsAppIcon size={16} />
        </a>
      </div>

      {/* Countdown + botón de pago para pedidos Wompi pendientes */}
      {showCountdown && (
        <PaymentCountdownBanner
          saleId={sale.id}
          createdAt={sale.created_at}
          onExpired={onRefresh}
          onPaymentStarted={onRefresh}
        />
      )}
    </div>
  );
}
