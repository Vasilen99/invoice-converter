import { format, isValid, parseISO } from "date-fns";

const ISO_DATE_FORMAT = "yyyy-MM-dd";

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toUtcNoonDate(parts: DateParts): Date {
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0),
  );
}

function isValidDateParts(parts: DateParts): boolean {
  if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31) {
    return false;
  }

  const utcNoon = toUtcNoonDate(parts);
  return (
    utcNoon.getUTCFullYear() === parts.year &&
    utcNoon.getUTCMonth() + 1 === parts.month &&
    utcNoon.getUTCDate() === parts.day
  );
}

function parseDateParts(
  value: string | Date | null | undefined,
): DateParts | null {
  if (!value) return null;

  if (value instanceof Date) {
    if (!isValid(value)) return null;
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
    };
  }

  const input = String(value).trim();
  if (!input) return null;

  const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const parts: DateParts = {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
    };
    return isValidDateParts(parts) ? parts : null;
  }

  const dmyMatch = input.match(/^(\d{1,2})[.-](\d{1,2})[.-](\d{2}|\d{4})$/);
  if (dmyMatch) {
    const yearRaw = Number(dmyMatch[3]);
    const year =
      dmyMatch[3].length === 2
        ? yearRaw > 50
          ? 1900 + yearRaw
          : 2000 + yearRaw
        : yearRaw;
    const parts: DateParts = {
      day: Number(dmyMatch[1]),
      month: Number(dmyMatch[2]),
      year,
    };
    return isValidDateParts(parts) ? parts : null;
  }

  const parsedIso = parseISO(input);
  if (!isValid(parsedIso)) return null;

  const parsedParts: DateParts = {
    year: parsedIso.getUTCFullYear(),
    month: parsedIso.getUTCMonth() + 1,
    day: parsedIso.getUTCDate(),
  };
  return isValidDateParts(parsedParts) ? parsedParts : null;
}

function parseSupportedDate(
  value: string | Date | null | undefined,
): Date | null {
  const parts = parseDateParts(value);
  return parts ? toUtcNoonDate(parts) : null;
}

export function formatDateToBG(
  dateValue: string | Date | undefined | null,
): string {
  const parts = parseDateParts(dateValue);
  if (!parts) return "";
  return `${pad2(parts.day)}.${pad2(parts.month)}.${parts.year}`;
}

export function parseDateToBG(
  dateValue: string | Date | undefined | null,
): string {
  return formatDateToBG(dateValue);
}

export function formatDateLabel(dateValue: string | Date): string {
  return formatDateToBG(dateValue) || String(dateValue);
}

export function toIsoDateOrNull(
  dateValue: string | Date | null | undefined,
): string | null {
  const parts = parseDateParts(dateValue);
  if (!parts) return null;
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function formatDateForInput(
  dateValue: string | Date | null | undefined,
): string {
  return toIsoDateOrNull(dateValue) ?? "";
}

export function parseDateForDatabase(
  dateValue: string | Date | null | undefined,
): Date | null {
  return parseSupportedDate(dateValue);
}

export function getTodayForInput(): string {
  return format(new Date(), ISO_DATE_FORMAT);
}
