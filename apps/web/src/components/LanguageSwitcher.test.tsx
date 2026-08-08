import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { LanguageSwitcher } from './LanguageSwitcher'

describe('LanguageSwitcher', () => {
  afterEach(cleanup)

  it('renders both supported locales and calls onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <I18nProvider>
        <LanguageSwitcher locale="zh-CN" onChange={onChange} />
      </I18nProvider>,
    )

    const select = screen.getByRole('combobox', { name: '语言' })
    expect(select).toHaveValue('zh-CN')
    expect(screen.getByRole('option', { name: '简体中文' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument()

    await user.selectOptions(select, 'en-US')
    expect(onChange).toHaveBeenCalledWith('en-US')
  })

  it('supports a compact presentation without changing its contract', () => {
    render(
      <I18nProvider>
        <LanguageSwitcher locale="en-US" onChange={() => undefined} compact />
      </I18nProvider>,
    )

    expect(screen.getByRole('combobox', { name: '语言' }).closest('label')).toHaveClass('language-switcher-compact')
  })
})
