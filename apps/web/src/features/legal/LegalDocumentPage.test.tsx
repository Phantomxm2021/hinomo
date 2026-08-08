import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { LegalDocumentPage } from './LegalDocumentPage'

afterEach(cleanup)

function renderDocument(kind: 'privacy' | 'terms', entry: string) {
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/legal/:document" element={<LegalDocumentPage kind={kind} />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )
}

test('renders the Chinese privacy Markdown by default', () => {
  renderDocument('privacy', '/legal/privacy')

  expect(screen.getByRole('heading', { name: 'Nomo 隐私政策' })).toBeInTheDocument()
  expect(screen.getByRole('main').closest('.legal-page')).toHaveAttribute('lang', 'zh-CN')
  expect(screen.getByRole('link', { name: '← 返回注册' })).toHaveAttribute('href', '/register')
})

test('switches the terms Markdown to English and updates the URL', () => {
  renderDocument('terms', '/legal/terms?lang=zh-CN')

  fireEvent.change(screen.getByRole('combobox', { name: '语言' }), {
    target: { value: 'en-US' },
  })

  expect(screen.getByRole('heading', { name: 'Nomo Terms of Service' })).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('en-US')
  expect(document.documentElement.lang).toBe('en-US')
})
