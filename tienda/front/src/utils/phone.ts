export function normalizeCheckoutPhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  const colombianNumber = digits.length > 10 && digits.startsWith("57")
    ? digits.slice(2)
    : digits;
  return colombianNumber.slice(0, 10);
}

export function isValidCheckoutPhone(value: unknown) {
  return /^\d{10}$/.test(String(value || ""));
}
