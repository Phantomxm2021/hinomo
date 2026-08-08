import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, type PropsWithChildren } from 'react'
import { afterEach, expect, test } from 'vitest'
import { I18nProvider, useI18n } from '../i18n/I18nProvider'
import { SearchInputShell } from './SearchInputShell'

afterEach(cleanup)

test('provides the homepage search design tokens while forwarding input behavior', () => {
  render(<SearchInputShell aria-label="搜索测试" name="q" value="相机" readOnly />)

  const input = screen.getByRole('searchbox', { name: '搜索测试' })
  expect(input).toHaveValue('相机')
  expect(input).toHaveClass(
    'h-11',
    'w-full',
    'block',
    'text-body',
    'font-normal',
    'focus-visible:outline-none',
  )
  expect(screen.getByTestId('search-input-shell')).toHaveClass(
    'min-h-12',
    'rounded-control',
    'border-line',
    'bg-surface',
    'focus-within:border-brand',
  )
  expect(screen.getByTestId('search-input-shell').querySelector('.app-icon')).toHaveClass(
    'absolute',
    'pointer-events-none',
  )
})

test('localizes the clear action in English', async () => {
  const user = userEvent.setup()
  function EnglishProvider({ children }: PropsWithChildren) {
    const { setLocale } = useI18n()
    useEffect(() => setLocale('en-US'), [setLocale])
    return <>{children}</>
  }
  const onClear = () => undefined
  render(
    <I18nProvider>
      <EnglishProvider>
        <SearchInputShell aria-label="Search" name="q" value="camera" onClear={onClear} readOnly />
      </EnglishProvider>
    </I18nProvider>,
  )

  await user.click(screen.getByRole('button', { name: 'Clear search' }))
  expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveFocus()
})
