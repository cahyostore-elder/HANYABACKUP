export type PromoDestination =
  | { type: 'internal'; href: string }
  | { type: 'external'; href: string };

export function parsePromoDestination(value: string | null | undefined): PromoDestination | null;
