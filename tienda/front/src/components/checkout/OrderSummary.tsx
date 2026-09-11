import { formatPrice } from "../../utils/format";
import { CartItem } from "../../types";
import {
  calculateCartSubtotal,
  hasProductFreeShipping,
  isWholesaleCart
} from "../../utils/shipping";

interface OrderSummaryProps {
  cart: CartItem[];
  total: number;
  shippingCost?: number;
}

export function OrderSummary({ cart, total }: OrderSummaryProps) {
  const subtotal = calculateCartSubtotal(cart);
  const wholesaleApplied = isWholesaleCart(cart);
  const productFreeShipping = hasProductFreeShipping(cart);

  return (
    <section className="bg-black/5 dark:bg-white/5 rounded-2xl p-5 border border-black/8 dark:border-white/8">
      <h3 className="text-[10px] font-bold opacity-50 uppercase tracking-widest mb-3">
        Resumen
      </h3>
      <div className="flex flex-col gap-1.5 text-xs text-black/70 dark:text-white/70">
        {cart.map((item) => (
          <div key={item.product.id} className="flex justify-between">
            <span>{item.product.name} × {item.quantity}{item.product.price_level === 1 ? " (Mayorista)" : ""}</span>
            <span>${formatPrice(item.product.price * item.quantity)}</span>
          </div>
        ))}
      </div>
      {wholesaleApplied && (
        <p className="mt-3 rounded-lg bg-success/10 px-2.5 py-2 text-[11px] font-bold text-success">
          Precio mayorista aplicado a todo el pedido.
        </p>
      )}
      <div className="border-t border-black/10 dark:border-white/10 mt-3 pt-3 flex flex-col gap-1.5">
        <div className="flex justify-between text-xs text-black/60 dark:text-white/60">
          <span>Subtotal</span>
          <span>${formatPrice(subtotal)}</span>
        </div>
        {cart.length > 0 && productFreeShipping && (
          <p className="rounded-lg bg-success/10 px-2.5 py-2 text-[11px] font-semibold text-success">
            Envio gratis incluido en los productos seleccionados.
          </p>
        )}
        {cart.length > 0 && !productFreeShipping && (
          <p className="rounded-lg bg-black/5 px-2.5 py-2 text-[11px] font-semibold text-black/55 dark:bg-white/5 dark:text-white/55">
            El transporte se cotiza por separado con la transportadora.
          </p>
        )}
        <div className="flex justify-between font-bold text-base text-black dark:text-white">
          <span>Total productos</span>
          <span className="text-primary">${formatPrice(total)}</span>
        </div>
      </div>
    </section>
  );
}
