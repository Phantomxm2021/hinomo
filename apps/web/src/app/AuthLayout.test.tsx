import { cleanup, render, screen, within } from '@testing-library/react'
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
  expect(within(screen.getByRole('link', { name: 'Nomo' })).getByText('N')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByLabelText('Nomo 产品介绍')).toHaveClass('bg-sidebar')
  expect(screen.getByText('认证表单').parentElement).toHaveClass('bg-surface')
  expect(screen.getByText('让每件物品都有迹可循')).toBeInTheDocument()
  expect(screen.getByText('认证表单')).toBeInTheDocument()
})

test('keeps authentication titles compact on mobile', () => {
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/" element={<h1>登录</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

  expect(screen.getByRole('heading', { name: '登录' }).parentElement).toHaveClass(
    '[&_h1]:text-page-title',
    '[&_h1]:font-extrabold',
  )
})
