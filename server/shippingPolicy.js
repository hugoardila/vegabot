const SHIPPING_FEE = 0;
const FREE_SHIPPING_THRESHOLD = 250000;

function isWholesaleOrder(items = []) {
  return (Array.isArray(items) ? items : []).some((item) => {
    const level = item?.price_level ?? item?.product?.price_level;
    const tier = String(item?.priceTier ?? item?.price_tier ?? item?.product?.priceTier ?? "").toLowerCase();
    return Number(level) === 1 || tier === "mayorista" || tier === "wholesale";
  });
}

function hasProductFreeShipping(items = []) {
  const list = (Array.isArray(items) ? items : []).filter((item) => Number(item?.qty ?? item?.quantity ?? 1) > 0);
  return list.length > 0 && list.every((item) => {
    const value = item?.freeShipping ?? item?.free_shipping ?? item?.product?.freeShipping ?? item?.product?.free_shipping;
    if (typeof value === "string") return ["1", "true", "si", "yes", "on"].includes(value.trim().toLowerCase());
    return value === true || Number(value) === 1;
  });
}

function calculateShippingCost(subtotal, items = [], includeShipping = true) {
  void subtotal;
  void items;
  void includeShipping;
  return 0;
}

module.exports = {
  SHIPPING_FEE,
  FREE_SHIPPING_THRESHOLD,
  hasProductFreeShipping,
  isWholesaleOrder,
  calculateShippingCost
};
