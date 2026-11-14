const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED = "۰۱۲۳۴۵۶۷۸۹"; // Persian/Urdu forms some keyboards produce

/** Render a number with the Arabic-Indic digits used in the Omani textbooks (٤٢). */
export function toArabicDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_INDIC[Number(d)]!);
}

/**
 * Parse what a child typed. Accepts Western (42), Arabic-Indic (٤٢) and extended (۴۲)
 * digits; returns null for empty or non-integer input so it can be recorded as an
 * input problem rather than a concept error.
 */
export function parseNumberInput(raw: string): number | null {
  const normalised = raw
    .trim()
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(EXTENDED.indexOf(d)));
  if (!/^\d{1,3}$/.test(normalised)) return null;
  return Number(normalised);
}
