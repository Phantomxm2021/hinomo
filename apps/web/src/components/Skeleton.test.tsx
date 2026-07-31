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

test('labels a skeleton group while hiding its visible placeholders', () => {
  render(
    <SkeletonGroup className="grid" label="正在加载箱子">
      <Skeleton />
    </SkeletonGroup>,
  )

  const status = screen.getByRole('status', { name: '正在加载箱子' })
  expect(status).toHaveClass('grid')
  expect(status).toHaveTextContent('正在加载箱子')
  expect(status.querySelector('.sr-only')).toHaveTextContent('正在加载箱子')
  expect(screen.getByTestId('skeleton').parentElement).toHaveAttribute('aria-hidden', 'true')
})
