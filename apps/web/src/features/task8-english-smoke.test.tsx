import { cleanup, render, screen } from '@testing-library/react'
import { useEffect, type ReactNode } from 'react'
import { afterEach, expect, test } from 'vitest'
import { I18nProvider, useI18n } from '../i18n/I18nProvider'

function FeatureCopyProbe() {
  const { t } = useI18n()
  return (
    <div>
      <h1>{t('scanner.heading')}</h1>
      <h2>{t('packing.title')}</h2>
      <h2>{t('venues.title')}</h2>
      <h2>{t('credits.title')}</h2>
      <p>{t('profile.accountDetails')}</p>
      <button type="button" aria-label={t('credits.gateBuy')}>{t('credits.gateBuy')}</button>
    </div>
  )
}

function EnglishLocale({ children }: { children: ReactNode }) {
  const { setLocale } = useI18n()
  useEffect(() => setLocale('en-US'), [setLocale])
  return <>{children}</>
}

afterEach(() => {
  cleanup()
  try {
    window.localStorage?.clear()
  } catch {
    // jsdom may expose a window without a usable storage backend.
  }
})

test('renders Task 8 feature copy in English from the global locale', () => {
  render(<I18nProvider><EnglishLocale><FeatureCopyProbe /></EnglishLocale></I18nProvider>)

  expect(screen.getByRole('heading', { name: 'Scan to view' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'AI packing' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Venue management' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'AI credits' })).toBeInTheDocument()
  expect(screen.getByText('Account details')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Buy credits' })).toBeInTheDocument()
})
