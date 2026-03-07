import { getTodayLondonDate } from '@/lib/stockDate';

export type NormalizedStockStatus = 'in_stock' | 'scheduled' | 'out';

export type StockComparable = {
  stock_status?: string | null;
  stock_return_date?: string | null;
  available?: boolean | null;
  out_of_stock?: boolean | null;
};

export type AddonStockComparable = {
  stock_status?: string | null;
  stock_return_date?: string | null;
  available?: boolean | null;
};

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDateOnly = (value?: string | null): string | null => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (ISO_DATE_ONLY.test(trimmed)) return trimmed;
  const candidate = trimmed.slice(0, 10);
  return ISO_DATE_ONLY.test(candidate) ? candidate : null;
};

export const normalizeStockStatus = (status: string | null | undefined): NormalizedStockStatus => {
  if (status === 'scheduled') return 'scheduled';
  if (status === 'out') return 'out';
  return 'in_stock';
};

export const isScheduledStockEffectivelyAvailable = (
  stockReturnDate: string | null | undefined,
  londonToday = getTodayLondonDate()
): boolean => {
  const normalizedReturnDate = normalizeDateOnly(stockReturnDate);
  if (!normalizedReturnDate) return false;
  return normalizedReturnDate <= londonToday;
};

export const getEffectiveStockDisplayStatus = (
  entity: Pick<StockComparable, 'stock_status' | 'stock_return_date' | 'available' | 'out_of_stock'> | null | undefined,
  londonToday = getTodayLondonDate()
): NormalizedStockStatus => {
  if (!entity) return 'out';
  if (entity.available === false || entity.out_of_stock === true) return 'out';

  const rawStatus = normalizeStockStatus(entity.stock_status);
  if (rawStatus === 'scheduled' && isScheduledStockEffectivelyAvailable(entity.stock_return_date, londonToday)) {
    return 'in_stock';
  }

  return rawStatus;
};

export const isOutOfStockEntity = (entity: StockComparable | null | undefined): boolean => {
  return getEffectiveStockDisplayStatus(entity) !== 'in_stock';
};

export const isInStockAddonOption = (option: AddonStockComparable | null | undefined): boolean => {
  if (!option || option.available === false) return false;
  return getEffectiveStockDisplayStatus(option) === 'in_stock';
};

export const isEffectivelyBackInStock = (entity: StockComparable | null | undefined): boolean => {
  if (!entity || entity.available === false || entity.out_of_stock === true) return false;
  return (
    normalizeStockStatus(entity.stock_status) === 'scheduled' &&
    getEffectiveStockDisplayStatus(entity) === 'in_stock'
  );
};
