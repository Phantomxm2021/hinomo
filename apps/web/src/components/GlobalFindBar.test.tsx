import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, expect, test } from 'vitest'
import { GlobalFindBar } from './GlobalFindBar'

afterEach(cleanup)

function renderFindBar() {
  const router = createMemoryRouter(
    [{ path: '*', element: <GlobalFindBar /> }],
    { initialEntries: ['/app'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

test('renders accessible search controls and the scan link', () => {
  renderFindBar()

  expect(screen.getByRole('search')).toHaveClass('flex', 'items-stretch')
  expect(screen.getByRole('searchbox', { name: '搜索物品或箱子' })).toHaveClass(
    'h-11', 'text-body', 'focus-visible:outline-none',
  )
  expect(screen.getByTestId('search-input-shell')).toHaveClass('min-h-12', 'rounded-control')
  expect(screen.getByRole('button', { name: '搜索' })).toHaveClass('lg:hidden', 'size-12')
  expect(screen.getByRole('searchbox', { name: '搜索物品或箱子' })).toHaveAttribute('name', 'q')
  expect(screen.getByRole('searchbox', { name: '搜索物品或箱子' })).toHaveAttribute('enterkeyhint', 'search')
  expect(screen.getByRole('link', { name: '扫码查看' })).toHaveAttribute('href', '/app/scan')
  expect(screen.getByRole('link', { name: '扫码查看' })).toHaveClass(
    'hidden',
    'lg:inline-flex',
    'size-[46px]',
    'shrink-0',
    'shadow-soft',
    'transition',
    'focus-visible:outline-3',
    'focus-visible:outline-brand/45',
  )
  expect(screen.getByRole('link', { name: '扫码查看' })).not.toHaveClass(
    'h-[46px]',
    'w-[46px]',
    'flex-none',
    'transition-colors',
  )
  expect(screen.getByRole('link', { name: '扫码查看' })).toHaveAttribute('title', '扫码查看')
})

test('places the searchbox and scan link in keyboard order', async () => {
  const user = userEvent.setup()
  renderFindBar()

  await user.tab()
  expect(screen.getByRole('searchbox', { name: '搜索物品或箱子' })).toHaveFocus()
  await user.tab()
  expect(screen.getByRole('button', { name: '搜索' })).toHaveFocus()
  await user.tab()
  expect(screen.getByRole('link', { name: '扫码查看' })).toHaveFocus()
})

test('navigates from the visible mobile search button', async () => {
  const user = userEvent.setup()
  const router = renderFindBar()

  await user.type(screen.getByRole('searchbox', { name: '搜索物品或箱子' }), '  相机  ')
  await user.click(screen.getByRole('button', { name: '搜索' }))

  expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(
    '/app/search?q=%E7%9B%B8%E6%9C%BA',
  )
})

test('uses an aligned custom clear button and restores input focus', async () => {
  const user = userEvent.setup()
  renderFindBar()

  const input = screen.getByRole('searchbox', { name: '搜索物品或箱子' })
  await user.type(input, '相机')
  const clearButton = screen.getByRole('button', { name: '清除搜索' })
  expect(clearButton).toHaveClass('size-9', 'self-center', 'shrink-0')
  expect(input).toHaveClass('appearance-none', '[&::-webkit-search-cancel-button]:hidden')
  await user.click(clearButton)

  expect(input).toHaveValue('')
  expect(input).toHaveFocus()
  expect(screen.queryByRole('button', { name: '清除搜索' })).not.toBeInTheDocument()
})

test('navigates to the encoded search query on submit', async () => {
  const user = userEvent.setup()
  const router = renderFindBar()

  await user.type(screen.getByRole('searchbox', { name: '搜索物品或箱子' }), '充电器')
  await user.click(screen.getByRole('searchbox', { name: '搜索物品或箱子' }))
  await user.keyboard('{Enter}')

  expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(
    '/app/search?q=%E5%85%85%E7%94%B5%E5%99%A8',
  )
})

test('does not navigate for an empty or whitespace-only query', async () => {
  const user = userEvent.setup()
  const router = renderFindBar()

  await user.click(screen.getByRole('searchbox', { name: '搜索物品或箱子' }))
  await user.keyboard('{Enter}')
  expect(`${router.state.location.pathname}${router.state.location.search}`).toBe('/app')

  await user.type(screen.getByRole('searchbox', { name: '搜索物品或箱子' }), '   ')
  await user.click(screen.getByRole('searchbox', { name: '搜索物品或箱子' }))
  await user.keyboard('{Enter}')
  expect(`${router.state.location.pathname}${router.state.location.search}`).toBe('/app')
})
