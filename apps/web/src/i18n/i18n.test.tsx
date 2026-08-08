import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { I18nProvider, useI18n } from './I18nProvider'
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  parseLocale,
} from './locale'
import { messages } from './messages'

function Probe() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div>
      <output data-testid="locale">{locale}</output>
      <output data-testid="app-name">{t('common.appName')}</output>
      <output data-testid="greeting">{t('common.greeting', { name: 'Mina' })}</output>
      <output data-testid="fallback">{t('landing.title')}</output>
      <output data-testid="missing">{t('common.doesNotExist')}</output>
      <button type="button" onClick={() => setLocale('en-US')}>
        English
      </button>
      <button type="button" onClick={() => setLocale('zh-CN')}>
        中文
      </button>
      <button type="button" onClick={() => setLocale('fr-FR' as never)}>
        Invalid locale
      </button>
    </div>
  )
}

describe('I18nProvider', () => {
  afterEach(cleanup)

  beforeEach(() => {
    const values = new Map<string, string>()
    const storage: Storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
      clear: () => values.clear(),
      key: (index) => [...values.keys()][index] ?? null,
      get length() {
        return values.size
      },
    }
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage,
    })
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: storage,
    })
    storage.clear()
    document.documentElement.lang = ''
    vi.restoreAllMocks()
  })

  test('defaults to Simplified Chinese and exposes translated content', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByTestId('locale')).toHaveTextContent(DEFAULT_LOCALE)
    expect(screen.getByTestId('app-name')).toHaveTextContent('Nomo')
    expect(document.documentElement.lang).toBe(DEFAULT_LOCALE)
  })

  test('reads a valid locale preference from localStorage', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en-US')

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByTestId('locale')).toHaveTextContent('en-US')
    expect(screen.getByTestId('app-name')).toHaveTextContent('Nomo')
    expect(document.documentElement.lang).toBe('en-US')
  })

  test('falls back to zh-CN for an unknown stored value', () => {
    expect(parseLocale('fr-FR')).toBe(DEFAULT_LOCALE)
    localStorage.setItem(LOCALE_STORAGE_KEY, 'fr-FR')

    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByTestId('locale')).toHaveTextContent(DEFAULT_LOCALE)
  })

  test('persists a valid switch and updates document language', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'English' }))

    expect(screen.getByTestId('locale')).toHaveTextContent('en-US')
    expect(screen.getByTestId('app-name')).toHaveTextContent('Nomo')
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en-US')
    expect(document.documentElement.lang).toBe('en-US')
  })

  test('ignores invalid locale values passed at runtime', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Invalid locale' }))

    expect(screen.getByTestId('locale')).toHaveTextContent(DEFAULT_LOCALE)
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull()
  })

  test('interpolates named values in a message', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByTestId('greeting')).toHaveTextContent('你好，Mina')
  })

  test('falls back to the Chinese message when the active locale is missing a key', async () => {
    const englishMessages = messages['en-US'] as Record<string, unknown>
    const englishLandingMessages = englishMessages.landing as Record<string, unknown>
    const original = englishLandingMessages.title
    Reflect.deleteProperty(englishLandingMessages, 'title')

    try {
      const user = userEvent.setup()
      render(
        <I18nProvider>
          <Probe />
        </I18nProvider>,
      )
      await user.click(screen.getByRole('button', { name: 'English' }))

      expect(screen.getByTestId('fallback')).toHaveTextContent('让每件物品都有迹可循')
    } finally {
      englishLandingMessages.title = original
    }
  })

  test('returns the key and warns when both locales are missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )

    expect(screen.getByTestId('missing')).toHaveTextContent('common.doesNotExist')
    if (import.meta.env.DEV) {
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('common.doesNotExist'),
      )
    }
  })

  test('supports switching back to Chinese without a profile dependency', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'English' }))
    await user.click(screen.getByRole('button', { name: '中文' }))

    expect(screen.getByTestId('locale')).toHaveTextContent(DEFAULT_LOCALE)
    expect(document.documentElement.lang).toBe(DEFAULT_LOCALE)
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe(DEFAULT_LOCALE)
  })

  test('setLocale can be called from an event without requiring act manually', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    )

    act(() => {
      screen.getByRole('button', { name: 'English' }).click()
    })

    expect(screen.getByTestId('locale')).toHaveTextContent('en-US')
  })
})
