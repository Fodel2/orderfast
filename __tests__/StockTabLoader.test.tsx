import { STOCK_TAB_QUERY } from '../components/stockTabQuery';

describe('StockTabLoader query', () => {
  it('filters archived categories and items', () => {
    expect(STOCK_TAB_QUERY).toMatch(/c\.archived_at IS NULL/i);
    expect(STOCK_TAB_QUERY).toMatch(/i\.archived_at IS NULL/i);
  });
});
