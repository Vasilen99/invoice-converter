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

/** Normalizes BULSTAT string preserving original characters. */
export function normalizeBulstat(value: string | undefined | null): string {
  return (value ?? "").trim();
}

/** Parses decimal-like values with comma support. */
export function parseDecimal(value: unknown, fallback = 0): number {
  const normalized = normalizeText(value)
    .replace(/[^\d.,-]/g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
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

export const calculateCreditsNeeded = (
  creditsCost: number,
  totalCredits: number,
  selectedFiles?: File[],
) => {
  if (!selectedFiles || !creditsCost) {
    return null;
  }

  if (selectedFiles.length && creditsCost) {
    const totalCreditsNeeded = selectedFiles.length * creditsCost;
    return totalCredits > totalCreditsNeeded;
  }
};

export const formatInvoiceSequence = (sequence: number): string => {
  const safeSequence = Number.isFinite(sequence) ? Math.max(0, sequence) : 0;
  return String(safeSequence).padStart(10, "0");
};

export const parseInvoiceSequence = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  const digits = String(value).replace(/\D/g, "");
  if (!digits) {
    return 0;
  }

  const parsed = parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};
