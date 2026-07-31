import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { Skeleton, SkeletonGroup } from './Skeleton'

afterEach(cleanup)

test('renders an inert skeleton with the standard appearance and div attributes', () => {
  render(<Skeleton className="h-6" id="title-placeholder" />)

  const skeleton = screen.getByTestId('skeleton')
  expect(skeleton).toHaveAttribute('aria-hidden', 'true')
  expect(skeleton).toHaveAttribute('id', 'title-placeholder')
  expect(skeleton).toHaveClass('rounded-control', 'bg-placeholder/80', 'motion-safe:animate-pulse', 'h-6')
})

test('can render an inert inline skeleton as a span', () => {
  render(<Skeleton as="span" className="h-4 w-16" title="布局加载中" />)

  const skeleton = screen.getByTestId('skeleton')
  expect(skeleton.tagName).toBe('SPAN')
  expect(skeleton).toHaveAttribute('aria-hidden', 'true')
  expect(skeleton).toHaveAttribute('title', '布局加载中')
})

test('labels a skeleton group while hiding its visible placeholders', () => {
  render(
    <SkeletonGroup className="grid" label="正在加载箱子">
      <Skeleton />
    </SkeletonGroup>,
  )

  const status = screen.getByRole('status', { name: '正在加载箱子' })
  expect(status).not.toHaveClass('grid')
  expect(status).toHaveTextContent('正在加载箱子')
  expect(status.querySelector('.sr-only')).toHaveTextContent('正在加载箱子')
  const visualLayout = screen.getByTestId('skeleton').parentElement
  expect(visualLayout).toHaveAttribute('aria-hidden', 'true')
  expect(visualLayout).toHaveClass('grid')
})
