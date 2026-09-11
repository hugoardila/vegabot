import React from "react";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";

import { Image } from "@heroui/image";
import { CartIcon, TrashIcon } from "../atoms/icons";
import { CartItem } from "../../types";
import { formatPrice } from "../../utils/format";
import {
  calculateCartSubtotal,
  hasProductFreeShipping,
  isWholesaleCart
} from "../../utils/shipping";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8080/api").replace("/api", "");
const getImageUrl = (url: string) => url.startsWith("http") ? url : `${API_BASE}${url}`;

interface CartSummaryProps {
  cart: CartItem[];
  removeFromCart?: (id: string) => void;
  updateQuantity?: (id: string, delta: number) => void;
  clearCart?: () => void;
  checkoutStatus?: { success: boolean; message: string } | null;
  total: number;
  shippingCost?: number;
  isSubmitting?: boolean;
  handleInitiateCheckout?: () => void;
  isReadOnly?: boolean;
}

export const CartSummary: React.FC<CartSummaryProps> = ({
  cart,
  removeFromCart,
  updateQuantity,
  clearCart,
  checkoutStatus,
  total,
  isSubmitting,
  handleInitiateCheckout,
  isReadOnly,
}) => {
  const subtotal = calculateCartSubtotal(cart);
  const wholesaleApplied = isWholesaleCart(cart);
  const productFreeShipping = hasProductFreeShipping(cart);

  return (
  <div className="flex flex-col h-full text-black dark:text-white">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-xl font-bold flex items-center gap-2">
        Resumen
        <Chip color="default" size="sm" variant="flat">
          {cart.reduce((a, b) => a + b.quantity, 0)}
        </Chip>
      </h3>
      {!isReadOnly && cart.length > 0 && (
        <Button
          size="sm"
          variant="flat"
          color="danger"
          className="text-xs font-bold"
          onPress={clearCart}
        >
          Vaciar
        </Button>
      )}
    </div>

    <div className="flex-grow pr-2 h-full overflow-y-auto">
      {cart.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-black/20 dark:text-white/20 gap-3 border-2 border-dashed border-black/5 dark:border-white/5 rounded-3xl p-8">
          <CartIcon size={32} />
          <p className="text-center text-xs">Añadir productos</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cart.map((item) => (
            <div
              key={item.product.id}
              className="flex items-center gap-4 bg-black/5 dark:bg-white/10 p-3 rounded-2xl border border-black/5 dark:border-white/5"
            >
              <div className="size-10 rounded-lg overflow-hidden shrink-0 border border-black/10 dark:border-white/10">
                <Image
                  className="w-full h-full object-cover"
                  src={
                    item.product.images && item.product.images.length > 0
                      ? getImageUrl(item.product.images[0])
                      : "https://placehold.co/400x300?text=Sin+Imagen"
                  }
                />
              </div>
              <div className="flex-grow min-w-0">
                <p className="font-semibold text-xs truncate">
                  {item.product.name}
                </p>
                <p className="text-[10px] text-black/40 dark:text-white/40">
                  {item.product.price_level === 1 ? "Mayorista" : "Detal"} ${formatPrice(item.product.price)} x {item.quantity}
                </p>
              </div>
              
              {/* Quantity controls */}
              {/* Quantity controls */}
              {!isReadOnly ? (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-xs font-bold hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
                      onClick={() => updateQuantity?.(item.product.id, -1)}
                    >
                      -
                    </button>
                    <span className="text-sm font-bold w-6 text-center">
                      {item.quantity}
                    </span>
                    <button
                      className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-xs font-bold hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
                      onClick={() => updateQuantity?.(item.product.id, 1)}
                    >
                      +
                    </button>
                  </div>

                  <button
                    className="text-black/20 dark:text-white/20 hover:text-danger"
                    onClick={() => removeFromCart?.(item.product.id)}
                  >
                    <TrashIcon size={14} />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1 bg-black/5 dark:bg-white/10 rounded-lg">
                  <span className="text-xs font-bold">
                    {item.quantity} unds
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>

    <div className="mt-6 space-y-3 pt-4 border-t border-black/10 dark:border-white/10">
      <div className="space-y-2 mb-4"></div>

      {checkoutStatus && (
        <p
          className={`text-[11px] font-bold text-center px-2 py-1 rounded-lg ${
            checkoutStatus.success
              ? "bg-success/20 text-success"
              : "bg-danger/20 text-danger"
          }`}
        >
          {checkoutStatus.message}
        </p>
      )}

      {wholesaleApplied && (
        <p className="rounded-lg bg-success/10 px-3 py-2 text-center text-[11px] font-bold text-success">
          Precio mayorista aplicado a todo el carrito.
        </p>
      )}

      <div className="space-y-2 text-sm text-black/60 dark:text-white/60">
        <div className="flex justify-between">
          <p>Subtotal</p>
          <p>${formatPrice(subtotal)}</p>
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
      </div>

      <div className="flex justify-between text-xl font-bold text-primary">
        <p>Total productos</p>
        <p>${formatPrice(total)}</p>
      </div>
      {!isReadOnly && handleInitiateCheckout && (
        <Button
          className="w-full h-12 text-sm font-bold bg-primary text-white mt-2"
          isDisabled={cart.length === 0 || isSubmitting}
          isLoading={isSubmitting}
          onClick={() => handleInitiateCheckout()}
        >
          Completar compra
        </Button>
      )}
    </div>
  </div>
  );
};
