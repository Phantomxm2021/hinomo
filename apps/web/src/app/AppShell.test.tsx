import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test } from 'vitest'
import { AppShell } from './AppShell'

afterEach(cleanup)

function renderShell(initialEntry = '/app') {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<p>内容</p>} />
          <Route path="*" element={<p>内容</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

test('provides the complete desktop navigation without a scan destination', () => {
  renderShell()

  const navigation = screen.getByRole('navigation', { name: '主导航' })
  const links = within(navigation).getAllByRole('link')

  expect(links.map((link) => link.textContent)).toEqual([
    '今日收纳',
    '我的空间',
    '全部箱子',
    '查找物品',
    '打印标签',
  ])
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    '/app',
    '/app/spaces',
    '/app/boxes',
    '/app/search',
    '/app/print',
  ])
  expect(within(navigation).queryByRole('link', { name: '扫码' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Nomo' })).toHaveAttribute('href', '/app')
  expect(screen.getByText('我的收纳空间')).toBeInTheDocument()
})

test('provides five mobile destinations with a central scan action', () => {
  renderShell()

  const navigation = screen.getByRole('navigation', { name: '移动端主导航' })
  const links = within(navigation).getAllByRole('link')

  expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
    '首页',
    '空间',
    '扫码',
    '箱子',
    '搜索',
  ])
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    '/app',
    '/app/spaces',
    '/app/scan',
    '/app/boxes',
    '/app/search',
  ])
  expect(within(navigation).getByRole('link', { name: '扫码' })).toHaveClass('mobile-scan-action')
})

test('marks the mobile scan action active on the scan route', () => {
  renderShell('/app/scan')

  const navigation = screen.getByRole('navigation', { name: '移动端主导航' })
  const scanLink = within(navigation).getByRole('link', { name: '扫码' })

  expect(scanLink).toHaveClass('mobile-scan-action', 'active')
  expect(scanLink).toHaveAttribute('aria-current', 'page')
  expect(within(navigation).getByRole('link', { name: '首页' })).not.toHaveAttribute('aria-current')
})

test('keeps the boxes destination active on nested box routes', () => {
  renderShell('/app/boxes/new')

  const navigation = screen.getByRole('navigation', { name: '移动端主导航' })
  const boxesLink = within(navigation).getByRole('link', { name: '箱子' })

  expect(boxesLink).toHaveClass('active')
  expect(boxesLink).toHaveAttribute('aria-current', 'page')
  expect(within(navigation).getByRole('link', { name: '扫码' })).not.toHaveAttribute('aria-current')
})
