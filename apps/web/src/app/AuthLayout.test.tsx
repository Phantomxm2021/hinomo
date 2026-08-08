import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { AuthLayout } from './AuthLayout'

afterEach(cleanup)

test('frames authentication forms with the Nomo product identity', () => {
  render(
    <I18nProvider>
      <MemoryRouter>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/" element={<p>认证表单</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )

  expect(screen.getByRole('link', { name: 'Nomo' })).toHaveAttribute('href', '/')
  expect(screen.getByRole('link', { name: 'Nomo' }).querySelector('img')).toHaveAttribute('src', '/brand/nomo-apple-icon-v2-192.png')
  expect(screen.getByLabelText('Nomo 产品介绍')).toHaveClass('bg-sidebar')
  expect(screen.getByText('认证表单').parentElement).toHaveClass('bg-surface')
  expect(screen.getByText('让每件物品都有迹可循')).toBeInTheDocument()
  expect(screen.getByText('让每件物品都有迹可循').parentElement).toHaveClass('px-5', 'md:px-7')
  expect(screen.getByText('认证表单')).toBeInTheDocument()
})

test('keeps the login page in one viewport and locks document scrolling', () => {
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<h1>登录</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )

  const title = screen.getByRole('heading', { name: '登录' })
  const shell = title.closest('.auth-shell')
  expect(title.parentElement).toHaveClass(
    '[&_h1]:text-page-title',
    '[&_h1]:font-extrabold',
  )
  expect(shell).toHaveClass('auth-login-shell', 'h-dvh', 'min-h-0')
  expect(shell).toHaveClass('md:my-0')
  expect(shell).toHaveAttribute('lang', 'zh-CN')
  expect(shell?.parentElement).toHaveClass('auth-login-viewport', 'grid', 'h-dvh', 'place-items-center', 'overflow-hidden')
  expect(screen.getByLabelText('Nomo 产品介绍')).toHaveClass('hidden', 'md:flex')
  expect(title.closest('.auth-form-panel')).toHaveClass('grid', 'h-full', 'place-items-center')
  expect(document.documentElement.style.overflow).toBe('hidden')
  expect(document.body.style.overflow).toBe('hidden')
  expect(document.body.style.overscrollBehavior).toBe('none')
})

test('applies the unified access layout to password recovery', () => {
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/forgot-password']}>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/forgot-password" element={<h1>忘记密码</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )

  const title = screen.getByRole('heading', { name: '忘记密码' })
  expect(title.closest('.auth-shell')).toHaveClass('auth-login-shell', 'h-dvh')
  expect(screen.getByLabelText('Nomo 产品介绍')).toHaveClass('hidden', 'md:flex')
  expect(document.body.style.overflow).toBe('hidden')
})
