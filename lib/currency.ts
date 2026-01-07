export const DEFAULT_CURRENCY_CODE = 'GBP';

export function normalizeCurrencyCode(code?: string | null) {
  if (typeof code === 'string' && code.trim()) {
    return code.trim().toUpperCase();
  }
  return DEFAULT_CURRENCY_CODE;
}

export function formatCurrency(amount: number, currencyCode?: string | null) {
  const normalizedCode = normalizeCurrencyCode(currencyCode);
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: normalizedCode,
    }).format(amount);
  } catch {
    const numeric = Number(amount);
    const safeAmount = Number.isFinite(numeric) ? numeric : 0;
    return `${normalizedCode} ${safeAmount.toFixed(2)}`;
  }
}

export function getCurrencySymbol(currencyCode?: string | null) {
  const normalizedCode = normalizeCurrencyCode(currencyCode);
  try {
    const parts = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: normalizedCode,
      currencyDisplay: 'symbol',
    }).formatToParts(0);
    const symbol = parts.find((part) => part.type === 'currency')?.value;
    return symbol || normalizedCode;
  } catch {
    return normalizedCode;
  }
}
