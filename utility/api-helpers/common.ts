/**
 * Shared pure helpers for API routes and client components.
 */

/** Trims unknown value into a string. */
export function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Keeps digits only for EIK/BULSTAT values. */
export function normalizeEik(value: unknown): string {
  return normalizeText(value).replace(/\D/g, "");
}

/** Parses decimal-like values with comma support. */
export function parseDecimal(value: unknown): number {
  const normalized = normalizeText(value)
    .replace(/[^\d.,-]/g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Money format with 2 decimal places. */
export function toMoney(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

/** Parses unknown JSON address shape into a safe object. */
export function parseJsonAddress(
  value: unknown,
): { settlement?: string; street?: string } | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const address = value as Record<string, unknown>;
  return {
    settlement:
      typeof address.settlement === "string" ? address.settlement : undefined,
    street: typeof address.street === "string" ? address.street : undefined,
  };
}
