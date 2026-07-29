import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { App } from './App'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}))

test('routes an anonymous visitor into the branded login experience', () => {
  render(<App />)

  expect(screen.getByRole('link', { name: 'Nomo' })).toHaveAttribute('href', '/')
  expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument()
})
