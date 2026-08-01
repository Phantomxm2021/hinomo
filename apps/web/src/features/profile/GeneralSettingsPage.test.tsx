import type { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../auth/auth-context'
import { GeneralSettingsPage } from './GeneralSettingsPage'

const { mockGetProfile, mockUpdateLocale } = vi.hoisted(() => ({
  mockGetProfile: vi.fn(),
  mockUpdateLocale: vi.fn(),
}))

vi.mock('./profile.api', () => ({
  getProfile: mockGetProfile,
  updateLocale: mockUpdateLocale,
}))

beforeEach(() => {
  mockGetProfile.mockReset().mockResolvedValue({
    id: 'user-1', display_name: '林家', avatar_object_key: null, locale: 'zh-CN',
  })
  mockUpdateLocale.mockReset().mockResolvedValue(undefined)
})

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={{
          session: { user: { id: 'user-1', email: 'lin@example.com' } } as unknown as Session,
          loading: false,
          isPasswordRecovery: false,
        }}>
          <GeneralSettingsPage />
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

test('keeps language inside General and saves the new locale', async () => {
  const user = userEvent.setup()
  renderPage()

  const language = await screen.findByLabelText('语言')
  expect(language).toHaveValue('zh-CN')
  expect(screen.getByRole('group', { name: '语言与地区' })).toHaveClass('rounded-card', 'bg-surface', 'overflow-hidden')
  await user.selectOptions(language, 'en-US')

  await waitFor(() => expect(mockUpdateLocale.mock.calls[0]?.[0]).toBe('en-US'))
})
