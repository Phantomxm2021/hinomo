import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test } from 'vitest'
import { AppShell } from './AppShell'

afterEach(cleanup)

function renderShell() {
  render(
    <MemoryRouter initialEntries={['/app']}>
      <Routes>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<p>内容</p>} />
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
  expect(within(navigation).queryByRole('link', { name: '扫码' })).not.toBeInTheDocument()
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
  expect(within(navigation).getByRole('link', { name: '扫码' })).toHaveClass('mobile-scan-action')
})
