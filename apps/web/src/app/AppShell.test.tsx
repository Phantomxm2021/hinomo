import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test } from 'vitest'
import { AppShell } from './AppShell'

afterEach(cleanup)

test('provides four focused mobile destinations including the workbench', () => {
  render(
    <MemoryRouter initialEntries={['/app']}>
      <Routes>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<p>内容</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

  const navigation = screen.getByRole('navigation', { name: '移动端主导航' })
  const links = within(navigation).getAllByRole('link')
  expect(links).toHaveLength(4)
  expect(links.map((link) => link.textContent)).toEqual(['工作台', '箱子', '搜索', '扫码'])
  expect(within(navigation).getByRole('link', { name: '工作台' })).toHaveAttribute('href', '/app')
})
