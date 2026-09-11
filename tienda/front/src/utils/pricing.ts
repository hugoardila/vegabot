import { CartItem, Product } from "../types";

export const DEFAULT_WHOLESALE_POLICY = {
  minimumReferences: 2,
  minimumUnits: 6,
  minimumTotalUnits: 12,
  minimumAmount: 300000,
};

export type WholesalePolicy = typeof DEFAULT_WHOLESALE_POLICY;

function cleanPositiveInteger(value: unknown, fallback: number) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function cleanPrice(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(Math.round(number), 0) : 0;
}

export function getPromotionPercent(product: Product) {
  if (!product.promotion_enabled) return 0;
  const percent = Number(product.promotion_percent || 0);
  return Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 99) : 0;
}

function applyPromotion(price: number, product: Product) {
  const percent = getPromotionPercent(product);
  return percent > 0 ? Math.max(Math.round(price * (1 - percent / 100)), 0) : price;
}

export function getWholesalePolicy(settings: Record<string, unknown> = {}): WholesalePolicy {
  return {
    minimumReferences: cleanPositiveInteger(
      settings.minimumWholesaleReferences,
      DEFAULT_WHOLESALE_POLICY.minimumReferences,
    ),
    minimumUnits: cleanPositiveInteger(
      settings.minimumWholesaleUnits,
      DEFAULT_WHOLESALE_POLICY.minimumUnits,
    ),
    minimumTotalUnits: cleanPositiveInteger(
      settings.minimumWholesaleTotalUnits,
      DEFAULT_WHOLESALE_POLICY.minimumTotalUnits,
    ),
    minimumAmount: cleanPositiveInteger(
      settings.minimumWholesaleAmount,
      DEFAULT_WHOLESALE_POLICY.minimumAmount,
    ),
  };
}

export function getRetailPrice(product: Product) {
  return applyPromotion(cleanPrice(product.price_2 ?? product.price), product);
}

export function getWholesalePrice(product: Product) {
  return cleanPrice(product.price_1);
}

export function priceStoreCart(cart: CartItem[], policy: WholesalePolicy = DEFAULT_WHOLESALE_POLICY) {
  const totalUnits = cart.reduce((sum, item) => sum + Math.max(Number(item.quantity || 0), 0), 0);
  const retailSubtotal = cart.reduce(
    (sum, item) => sum + getRetailPrice(item.product) * item.quantity,
    0,
  );
  const qualifyingReferences = cart.filter(
    (item) => item.quantity >= policy.minimumUnits && getWholesalePrice(item.product) > 0,
  ).length;
  const wholesaleOrder = qualifyingReferences >= policy.minimumReferences
    && totalUnits >= policy.minimumTotalUnits
    && retailSubtotal >= policy.minimumAmount;

  const items = cart.map((item) => {
    const wholesalePrice = getWholesalePrice(item.product);
    const retailPrice = getRetailPrice(item.product);
    const useWholesalePrice = wholesaleOrder && wholesalePrice > 0;
    return {
      ...item,
      product: {
        ...item.product,
        price: useWholesalePrice ? wholesalePrice : retailPrice,
        price_level: useWholesalePrice ? 1 as const : 2 as const,
      },
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return {
    items,
    subtotal,
    retailSubtotal,
    savings: Math.max(retailSubtotal - subtotal, 0),
    totalUnits,
    qualifyingReferences,
    wholesaleOrder,
    policy,
  };
}
