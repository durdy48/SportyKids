// Supported locales and countries — single source of truth
export const SUPPORTED_LOCALES = ['es', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const SUPPORTED_COUNTRIES = ['ES', 'GB', 'US', 'FR', 'IT', 'DE'] as const;
export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];

const LOCALE_TO_COUNTRY: Record<string, SupportedCountry> = {
  es: 'ES',
  en: 'GB',
};

/** Infer a default country from a locale code. Returns 'ES' for unknown locales. */
export function inferCountryFromLocale(locale: string): SupportedCountry {
  return LOCALE_TO_COUNTRY[locale] ?? 'ES';
}
