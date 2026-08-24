/**
 * Date formatting tied to the interface language.
 *
 * A bare toLocaleDateString() follows the browser's locale, not the language the
 * user chose, so a Finnish interface rendered trip dates as 8/31/2026. The mapping
 * was also copied into two pages and left out Somali entirely.
 */

/** i18n language codes to the BCP 47 locales used for dates and numbers. */
const DATE_LOCALES: Record<string, string> = {
  fi: 'fi-FI',
  sv: 'sv-SE',
  ar: 'ar-SA',
  ru: 'ru-RU',
  so: 'so-SO',
  en: 'en-GB',
};

/**
 * The locale to format dates in for a given interface language.
 *
 * English falls back to en-GB rather than en-US: day/month order matches the other
 * five and matches what a reader in Finland expects. An unknown language falls back
 * to Finnish, this being a Finnish product.
 */
export function dateLocale(language: string | undefined): string {
  if (!language) return DATE_LOCALES.fi;
  return DATE_LOCALES[language.split('-')[0]] ?? DATE_LOCALES.fi;
}

/** A date in the interface language. Invalid input renders as an em dash. */
export function formatDate(
  value: string | number | Date | null | undefined,
  language: string | undefined,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric' }
): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(dateLocale(language), options);
}

/** A date written out in full, for headings and confirmations. */
export function formatLongDate(
  value: string | number | Date | null | undefined,
  language: string | undefined
): string {
  return formatDate(value, language, { year: 'numeric', month: 'long', day: 'numeric' });
}
