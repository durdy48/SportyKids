import es from './es.json';
import en from './en.json';

export type Locale = 'es' | 'en';

const translations: Record<Locale, Record<string, unknown>> = { es, en };

export function t(key: string, locale: Locale = 'es', params?: Record<string, string>): string {
  const keys = key.split('.');
  let value: unknown = translations[locale];

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return key; // Fallback: return the key itself
    }
  }

  if (typeof value !== 'string') return key;

  // Replace {param} and {{param}} placeholders
  if (params) {
    return Object.entries(params).reduce(
      (str, [k, v]) => str.replace(`{{${k}}}`, v).replace(`{${k}}`, v),
      value,
    );
  }

  return value;
}

export function getSportLabel(sport: string, locale: Locale = 'es'): string {
  return t(`sports.${sport}`, locale);
}

export function getAgeRangeLabel(range: string, locale: Locale = 'es'): string {
  return t(`age_ranges.${range}`, locale);
}
