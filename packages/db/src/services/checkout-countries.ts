// Where Stripe checkout ships to. Structured data advertises exactly these.
export const EU_CHECKOUT_COUNTRIES = ["DE", "AT", "BG", "FR", "NL", "BE"] as const;
export const NON_EU_CHECKOUT_COUNTRIES = ["CH", "GB", "US"] as const;
export const CHECKOUT_COUNTRIES = ["DE", "AT", "CH", "GB", "US", "BG", "FR", "NL", "BE"] as const;
