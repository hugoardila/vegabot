/**
 * Formats a number as a currency string with dots as thousands separators.
 * Example: 10000 -> "10.000"
 */
export const formatPrice = (price: number | string): string => {
  if (price === undefined || price === null || price === "") return "";
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(num)) return "0";
  
  // Using de-DE locale which uses dot for thousands and comma for decimals
  // We force 0 minimum fraction digits for integer-like display as per user request
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
};

/**
 * Parses a formatted currency string back to a number.
 * Example: "10.000" -> 10000
 */
export const parsePrice = (priceStr: string): number => {
  if (!priceStr) return 0;
  // Remove dots (thousands separators) and replace comma with dot for parsing if needed
  const cleanStr = priceStr.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
};
