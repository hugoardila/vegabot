const DEFAULT_WHOLESALE_MIN_AMOUNT = 300000;
const DEFAULT_WHOLESALE_MIN_UNITS = 6;
const DEFAULT_WHOLESALE_MIN_REFERENCES = 2;
const DEFAULT_WHOLESALE_MIN_TOTAL_UNITS = 12;

function cleanMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(Math.round(number), 0) : 0;
}

function getPromotionPercent(product = {}) {
  const enabled = product.promotionEnabled ?? product.promotion_enabled;
  const isEnabled = enabled === true || Number(enabled) === 1 || String(enabled).toLowerCase() === "true";
  if (!isEnabled) return 0;
  const percent = Number(product.promotionPercent ?? product.promotion_percent ?? 0);
  return Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 99) : 0;
}

function applyPromotion(price, product) {
  const percent = getPromotionPercent(product);
  return percent > 0 ? cleanMoney(price * (1 - percent / 100)) : cleanMoney(price);
}

function getWholesalePolicy(settings = {}) {
  const minimumAmount = cleanMoney(settings.minimumWholesaleAmount ?? settings.minimumAmount) || DEFAULT_WHOLESALE_MIN_AMOUNT;
  const minimumUnits = Math.max(
    Math.round(Number(settings.minimumWholesaleUnits ?? settings.minimumUnits) || DEFAULT_WHOLESALE_MIN_UNITS),
    1
  );
  const minimumReferences = Math.max(
    Math.round(Number(settings.minimumWholesaleReferences ?? settings.minimumReferences) || DEFAULT_WHOLESALE_MIN_REFERENCES),
    1
  );
  const minimumTotalUnits = Math.max(
    Math.round(Number(settings.minimumWholesaleTotalUnits ?? settings.minimumTotalUnits) || DEFAULT_WHOLESALE_MIN_TOTAL_UNITS),
    1
  );
  return { minimumAmount, minimumUnits, minimumReferences, minimumTotalUnits };
}

function getWholesalePrice(product = {}) {
  return cleanMoney(
    product.price1
      ?? product.wholesalePriceSnapshot
      ?? product.wholesalePrice
      ?? 0
  );
}

function getRetailPrice(product = {}) {
  return applyPromotion(
    product.price2
      ?? product.retailPriceSnapshot
      ?? product.retailPrice
      ?? 0,
    product
  );
}

function priceBotCart(items = [], settings = {}) {
  const policy = getWholesalePolicy(settings);
  const normalized = items.map((item, index) => {
    const qty = Math.max(Math.round(Number(item.qty ?? item.quantity ?? 1) || 1), 1);
    const wholesalePrice = getWholesalePrice(item);
    const retailPrice = getRetailPrice(item);
    const reference = String(item.sku ?? item.productId ?? item.product_id ?? item.id ?? index);
    return { ...item, qty, reference, wholesalePrice, retailPrice };
  });

  const quantitiesByReference = new Map();
  for (const item of normalized) {
    const current = quantitiesByReference.get(item.reference) || { qty: 0, hasWholesalePrice: false };
    current.qty += item.qty;
    current.hasWholesalePrice = current.hasWholesalePrice || item.wholesalePrice > 0;
    quantitiesByReference.set(item.reference, current);
  }
  const qualifyingReferences = [...quantitiesByReference.values()].filter(
    (item) => item.qty >= policy.minimumUnits && item.hasWholesalePrice
  ).length;
  const totalUnits = normalized.reduce((sum, item) => sum + item.qty, 0);
  const retailSubtotal = normalized.reduce(
    (sum, item) => sum + item.qty * item.retailPrice,
    0
  );
  const wholesaleOrder = qualifyingReferences >= policy.minimumReferences
    && totalUnits >= policy.minimumTotalUnits
    && retailSubtotal >= policy.minimumAmount;

  const pricedItems = normalized.map((item) => {
    const isWholesale = wholesaleOrder && item.wholesalePrice > 0;
    const unitPrice = isWholesale ? item.wholesalePrice : item.retailPrice;
    return {
      ...item,
      price: unitPrice,
      unitPrice,
      lineTotal: item.qty * unitPrice,
      priceTier: isWholesale ? "mayorista" : "detal"
    };
  });

  return {
    items: pricedItems,
    subtotal: pricedItems.reduce((sum, item) => sum + item.lineTotal, 0),
    candidateSubtotal: retailSubtotal,
    retailSubtotal,
    totalUnits,
    qualifyingReferences,
    wholesaleOrder,
    ...policy
  };
}

module.exports = {
  DEFAULT_WHOLESALE_MIN_AMOUNT,
  DEFAULT_WHOLESALE_MIN_UNITS,
  DEFAULT_WHOLESALE_MIN_REFERENCES,
  DEFAULT_WHOLESALE_MIN_TOTAL_UNITS,
  getRetailPrice,
  getPromotionPercent,
  getWholesalePolicy,
  getWholesalePrice,
  priceBotCart
};
