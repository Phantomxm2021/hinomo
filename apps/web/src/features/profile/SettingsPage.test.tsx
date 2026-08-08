import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { SettingsPage } from './SettingsPage'
import { I18nProvider } from '../../i18n/I18nProvider'

test('presents General as the second-level settings destination', () => {
  render(<I18nProvider><MemoryRouter><SettingsPage /></MemoryRouter></I18nProvider>)

  expect(screen.getByRole('navigation', { name: '设置导航' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /通用.*语言与地区/ })).toHaveAttribute('href', '/app/me/settings/general')
  expect(screen.queryByLabelText('语言')).not.toBeInTheDocument()
})
