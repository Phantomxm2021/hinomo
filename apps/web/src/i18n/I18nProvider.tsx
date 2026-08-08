import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_LOCALE,
  isLocale,
  persistLocalePreference,
  readLocalePreference,
  type Locale,
} from './locale'
import { messages, type MessageTree } from './messages'

export type TranslationParams = Record<string, string | number | boolean>

export type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: TranslationParams) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function resolveMessage(tree: MessageTree, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[segment]
  }, tree)

  return typeof value === 'string' ? value : undefined
}

function interpolate(message: string, params?: TranslationParams): string {
  if (!params) return message

  return message.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (placeholder, name) => {
    const value = params[name]
    return value === undefined ? placeholder : String(value)
  })
}

function warnMissingTranslation(locale: Locale, key: string): void {
  if (import.meta.env.DEV) {
    console.warn(`[i18n] Missing translation "${key}" for locale ${locale}`)
  }
}

// Feature components are also rendered in isolation by unit tests and by a few
// embedders. Keep those renders usable in the default locale while the app
// itself still provides the fully stateful I18nProvider at the root.
const standaloneI18nContext: I18nContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
  t: (key, params) => {
    const message = resolveMessage(messages[DEFAULT_LOCALE], key)
    return message === undefined ? key : interpolate(message, params)
  },
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readLocalePreference)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((nextLocale: Locale) => {
    if (!isLocale(nextLocale)) return

    setLocaleState(nextLocale)
    persistLocalePreference(nextLocale)
    if (typeof document !== 'undefined') {
      document.documentElement.lang = nextLocale
    }
  }, [])

  const t = useCallback(
    (key: string, params?: TranslationParams) => {
      const currentMessage = resolveMessage(messages[locale], key)
      if (currentMessage !== undefined) {
        return interpolate(currentMessage, params)
      }

      if (locale !== DEFAULT_LOCALE) {
        const fallbackMessage = resolveMessage(messages[DEFAULT_LOCALE], key)
        if (fallbackMessage !== undefined) {
          warnMissingTranslation(locale, key)
          return interpolate(fallbackMessage, params)
        }
      }

      warnMissingTranslation(locale, key)
      return key
    },
    [locale],
  )

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// The provider and its hook intentionally share one public module API.
// oxlint-disable-next-line react/only-export-components
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)

  return context ?? standaloneI18nContext
}
