export type Locale = 'zh-CN' | 'en-US'

export const DEFAULT_LOCALE: Locale = 'zh-CN'
export const LOCALE_STORAGE_KEY = 'nomo-locale'

export function isLocale(value: unknown): value is Locale {
  return value === 'zh-CN' || value === 'en-US'
}

export function parseLocale(value: string | null | undefined): Locale {
  return value === 'en-US' ? 'en-US' : DEFAULT_LOCALE
}

export function readLocalePreference(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE

  try {
    return parseLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY))
  } catch {
    return DEFAULT_LOCALE
  }
}

export function persistLocalePreference(locale: Locale): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // A blocked or unavailable localStorage should not prevent language switching.
  }
}
