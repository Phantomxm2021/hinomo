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

test('shows the product landing page before asking an anonymous visitor to sign in', () => {
  render(<App />)

  expect(screen.getAllByRole('link', { name: 'Nomo' })[0]).toHaveAttribute('href', '/')
  expect(screen.getByRole('heading', { name: '收起来。也找得回来。' })).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: '免费开始' })[0]).toHaveAttribute('href', '/register')
})
