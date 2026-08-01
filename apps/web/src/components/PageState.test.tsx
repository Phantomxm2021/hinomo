import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { PageState } from './PageState'

afterEach(cleanup)

test('announces loading with the supplied label', () => {
  render(<PageState state="loading" label="正在加载箱子" />)
  const status = screen.getByRole('status', { name: '正在加载箱子' })
  expect(status).toHaveTextContent('正在加载箱子')
  expect(screen.getAllByTestId('skeleton')).toHaveLength(3)
  expect(screen.getByText('正在加载箱子')).toHaveClass('sr-only')
})

test('renders an empty title and optional action', () => {
  render(<PageState state="empty" icon="box" title="还没有箱子" action={<a href="/new">创建箱子</a>} />)
  expect(screen.getByRole('heading', { name: '还没有箱子' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '创建箱子' })).toHaveAttribute('href', '/new')
  const empty = screen.getByText('还没有箱子').closest('[data-page-state="empty"]')
  expect(empty).not.toHaveClass('border', 'border-dashed', 'bg-surface/70')
  expect(screen.getByRole('link', { name: '创建箱子' }).parentElement).toHaveClass('mt-1')
})

test('retries an error state', async () => {
  const onRetry = vi.fn()
  render(<PageState state="error" message="箱子加载失败" onRetry={onRetry} />)
  expect(screen.getByRole('alert')).toHaveTextContent('箱子加载失败')
  await userEvent.click(screen.getByRole('button', { name: '重试' }))
  expect(onRetry).toHaveBeenCalledOnce()
})
