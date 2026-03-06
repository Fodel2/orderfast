export type StockComparable = {
  stock_status?: string | null;
  available?: boolean | null;
  out_of_stock?: boolean | null;
};

export type AddonStockComparable = {
  stock_status?: string | null;
  available?: boolean | null;
};

export const isOutOfStockEntity = (entity: StockComparable | null | undefined): boolean => {
  if (!entity) return true;
  return (
    entity.stock_status !== 'in_stock' ||
    entity.available === false ||
    entity.out_of_stock === true
  );
};

export const isInStockAddonOption = (option: AddonStockComparable | null | undefined): boolean => {
  if (!option) return false;
  return option.stock_status === 'in_stock' && option.available !== false;
};
