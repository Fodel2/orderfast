export default function resolveRestaurantId(
  router: any,
  brand: unknown,
  fallback?: unknown
): string | undefined {
  // Accept several possible query keys
  const qp = (router?.query ?? {}) as Record<string, unknown>;
  const fromQuery =
    (typeof qp.restaurant_id === 'string' && qp.restaurant_id) ||
    (typeof qp.id === 'string' && qp.id) ||
    (typeof qp.r === 'string' && qp.r) ||
    undefined;

  // Accept brand context if it carries the id
  let fromBrand: string | undefined = undefined;
  if (brand && typeof brand === 'object') {
    const b = brand as any;
    if (typeof b.restaurant_id === 'string' && b.restaurant_id) fromBrand = b.restaurant_id;
    else if (typeof b.restaurantId === 'string' && b.restaurantId) fromBrand = b.restaurantId;
    else if (typeof b.id === 'string' && b.id) fromBrand = b.id;
  }

  // Optional explicit fallback (e.g., preloaded restaurant object/id)
  const fromFallback =
    (typeof fallback === 'string' && fallback) ||
    ((fallback && typeof fallback === 'object' && typeof (fallback as any).id === 'string') ? (fallback as any).id : undefined);

  return fromQuery || fromBrand || fromFallback;
}
