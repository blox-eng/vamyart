// apps/website/src/lib/formatPrice.ts

/**
 * Format a numeric EUR price for display.
 * Example: formatPrice(1200) → "€1,200"
 * Returns null when the input is not a finite number, so callers can choose
 * their own fallback copy ("price on request", etc).
 */
export function formatPrice(value: number | string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') return null;
    const n = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(n)) return null;
    return new Intl.NumberFormat('en-IE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
    }).format(n);
}
