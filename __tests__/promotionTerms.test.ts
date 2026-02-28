import { buildPromotionTermsPreview } from '@/lib/promotionTerms';

describe('buildPromotionTermsPreview', () => {
  it('returns empty array for missing values', () => {
    expect(buildPromotionTermsPreview(null)).toEqual([]);
    expect(buildPromotionTermsPreview(undefined, null, null)).toEqual([]);
  });

  it('builds basket discount terms safely', () => {
    const terms = buildPromotionTermsPreview(
      {
        type: 'basket_discount',
        channels: ['website', 'kiosk'],
        order_types: ['delivery'],
        min_subtotal: 20,
        max_uses_per_customer: 2,
      },
      { discount_type: 'percent', discount_value: 15, max_discount_cap: 10 }
    );

    expect(terms).toContain('Applies on: Website, Kiosk.');
    expect(terms).toContain('Order types: Delivery.');
    expect(terms).toContain('15% off basket (max £10.00).');
  });

  it('adds voucher lines only when applicable', () => {
    const noMeta = buildPromotionTermsPreview({ type: 'voucher' }, null, null);
    expect(noMeta).toContain('Voucher code required.');
    expect(noMeta).not.toContain('Single-use voucher.');

    const singleUse = buildPromotionTermsPreview({ type: 'voucher' }, null, { max_uses_per_customer: 1 });
    expect(singleUse).toContain('Single-use voucher.');
  });
});
