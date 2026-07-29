import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test } from 'vitest'
import { AuthLayout } from './AuthLayout'

afterEach(cleanup)

test('frames authentication forms with the Nomo product identity', () => {
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/" element={<p>认证表单</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

  expect(screen.getByRole('link', { name: 'Nomo' })).toHaveAttribute('href', '/')
  expect(screen.getByText('让每件物品都有迹可循')).toBeInTheDocument()
  expect(screen.getByText('认证表单')).toBeInTheDocument()
})
