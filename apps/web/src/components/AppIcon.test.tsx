import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { AppIcon } from './AppIcon'

afterEach(cleanup)

test('renders at 20 pixels by default and accepts an explicit size', () => {
  const { container, rerender } = render(<AppIcon name="home" />)
  const icon = container.querySelector('svg')

  expect(icon).toHaveAttribute('width', '20')
  expect(icon).toHaveAttribute('height', '20')

  rerender(<AppIcon name="home" size={22} />)

  expect(icon).toHaveAttribute('width', '22')
  expect(icon).toHaveAttribute('height', '22')
})

test.each(['family', 'history', 'share', 'copy'] as const)('renders the %s icon without an unknown name', (name) => {
  const { container } = render(<AppIcon name={name} size={24} />)
  expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 24 24')
  expect(container.querySelector('path')).toBeInTheDocument()
})
