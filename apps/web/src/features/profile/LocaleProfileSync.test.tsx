import type { Session } from '@supabase/supabase-js'
import { cleanup, render, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { MobileFeedbackContext, type MobileFeedbackApi } from '../../components/mobile-feedback'
import { AuthProvider } from '../auth/AuthProvider'
import { I18nProvider, useI18n } from '../../i18n/I18nProvider'
import { LocaleProfileSync } from '../../i18n/LocaleProfileSync'

const { mockUpdateLocale } = vi.hoisted(() => ({ mockUpdateLocale: vi.fn() }))

vi.mock('./profile.api', () => ({ updateLocale: mockUpdateLocale }))

function LocaleControl() {
  const { setLocale } = useI18n()
  return <button type="button" onClick={() => setLocale('en-US')}>English</button>
}

function renderSync(session: Session | null, feedback: Partial<MobileFeedbackApi> = {}, strict = false) {
  const api: MobileFeedbackApi = {
    notify: vi.fn(),
    showAlert: vi.fn(),
    showActionSheet: vi.fn(),
    error: vi.fn(),
    confirm: vi.fn(),
    dismiss: vi.fn(),
    ...feedback,
  }
  const content = (
    <I18nProvider>
      <MobileFeedbackContext.Provider value={api}>
        <AuthProvider session={session}>
          <LocaleProfileSync />
          <LocaleControl />
        </AuthProvider>
      </MobileFeedbackContext.Provider>
    </I18nProvider>
  )
  render(strict ? <StrictMode>{content}</StrictMode> : content)
  return api
}

const session = { user: { id: 'user-1', email: 'user@example.com' } } as unknown as Session

describe('LocaleProfileSync', () => {
  afterEach(cleanup)

  beforeEach(() => {
    mockUpdateLocale.mockReset().mockResolvedValue(undefined)
    if (typeof localStorage !== 'undefined') localStorage.removeItem('nomo-locale')
  })

  test('does not persist a locale without an authenticated user', async () => {
    const user = userEvent.setup()
    renderSync(null)

    await user.click(document.querySelector('button')!)

    await waitFor(() => expect(mockUpdateLocale).not.toHaveBeenCalled())
  })

  test('syncs each user and locale once, including StrictMode effects', async () => {
    const user = userEvent.setup()
    renderSync(session, {}, true)

    await waitFor(() => expect(mockUpdateLocale).toHaveBeenCalledWith('zh-CN'))
    expect(mockUpdateLocale).toHaveBeenCalledTimes(1)

    await user.click(document.querySelector('button')!)
    await waitFor(() => expect(mockUpdateLocale).toHaveBeenCalledWith('en-US'))
    expect(mockUpdateLocale).toHaveBeenCalledTimes(2)
  })

  test('reports a non-blocking save error through the global Apple feedback in the active locale', async () => {
    const user = userEvent.setup()
    mockUpdateLocale.mockRejectedValue(new Error('network'))
    const api = renderSync(session)

    await waitFor(() => expect(api.error).toHaveBeenCalledWith(expect.objectContaining({
      key: 'profile.locale.sync:user-1:zh-CN',
      title: '操作未完成',
      message: '语言保存失败，请重试',
    })))
    expect(api.notify).not.toHaveBeenCalled()
    await user.click(document.querySelector('button')!)
    await waitFor(() => expect(api.error).toHaveBeenCalledWith(expect.objectContaining({
      key: 'profile.locale.sync:user-1:en-US',
      title: 'Action couldn’t be completed',
      message: 'Could not save language. Please try again.',
    })))
  })
})
