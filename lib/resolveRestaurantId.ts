export default function resolveRestaurantId(
  router: any,
  brand: unknown,
  fallback?: unknown
): string | undefined {
  const qp = (router?.query ?? {}) as Record<string, unknown>;
  const pick = (value: unknown) => {
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return undefined;
    return trimmed;
  };

  const fromQuery =
    pick(qp.restaurant_id) ||
    pick(qp.id) ||
    pick(qp.r) ||
    undefined;

  let fromBrand: string | undefined = undefined;
  if (brand && typeof brand === 'object') {
    const b = brand as any;
    fromBrand = pick(b.restaurant_id) || pick(b.restaurantId) || pick(b.id);
  }

  const fromFallback =
    (typeof fallback === 'string' && fallback) ||
    ((fallback && typeof fallback === 'object' && typeof (fallback as any).id === 'string')
      ? (fallback as any).id
      : undefined);

  return fromQuery || fromBrand || fromFallback;
}
