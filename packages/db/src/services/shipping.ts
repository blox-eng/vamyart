export type ShippingType = "free" | "paid" | "custom";
type Method = { type: string; cost: string | null; displayText: string };

// One reading of a piece's shipping, shared by Stripe checkout, the buy box and
// the structured data: the product's method, else the default, else arranged by hand.
export function resolveShipping(
  method: Method | null | undefined,
  fallback?: Method | null,
): { type: ShippingType; cost: number | null; displayText: string } {
  const m = method ?? fallback;
  if (!m) return { type: "custom", cost: null, displayText: "Shipping arranged by artist" };
  return { type: m.type as ShippingType, cost: m.cost ? Number(m.cost) : null, displayText: m.displayText };
}
