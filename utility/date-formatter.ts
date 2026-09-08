/**
 * Format a date string in YYYY-MM-DD format to DD.MM.YY format (Bulgarian standard)
 * @param dateStr - Date string in YYYY-MM-DD format or DD.MM.YYYY format
 * @returns Formatted date string in DD.MM.YY format
 */
export function formatDateToBG(dateStr: string | undefined | null): string {
  if (!dateStr) return "";

  try {
    // Handle YYYY-MM-DD format (from HTML date input)
    if (dateStr.includes("-")) {
      const [year, month, day] = dateStr.split("-");
      return `${day}.${month}.${year.slice(-2)}`;
    }

    // Handle DD.MM.YYYY format (already in this format)
    if (dateStr.includes(".")) {
      const parts = dateStr.split(".");
      if (parts.length === 3) {
        const [day, month, year] = parts;
        // Convert YYYY to YY
        const shortYear = year.length === 4 ? year.slice(-2) : year;
        return `${day}.${month}.${shortYear}`;
      }
    }

    // Fallback: return as is
    return dateStr;
  } catch {
    return dateStr || "";
  }
}

/**
 * Parse a date string in various formats and return it in DD.MM.YY format
 * @param dateStr - Date string in any format
 * @returns Formatted date string in DD.MM.YY format
 */
export function parseDateToBG(dateStr: string | undefined | null): string {
  return formatDateToBG(dateStr);
}
