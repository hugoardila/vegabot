import { CartItem } from "../types";

export const SHIPPING_FEE = 0;
export const FREE_SHIPPING_THRESHOLD = 250000;

export function calculateCartSubtotal(cart: CartItem[]) {
  return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
}

export function isWholesaleCart(cart: CartItem[] = []) {
  return cart.some((item) => item.product.price_level === 1);
}

export function hasProductFreeShipping(cart: CartItem[] = []) {
  const items = cart.filter((item) => item.quantity > 0);
  return items.length > 0 && items.every((item) => item.product.free_shipping === true);
}

export function calculateShippingCost(subtotal: number, includeShipping = true, cart: CartItem[] = []) {
  void subtotal;
  void includeShipping;
  void cart;
  return 0;
}

export function calculateCartTotal(cart: CartItem[], includeShipping = true) {
  void includeShipping;
  return calculateCartSubtotal(cart);
}
