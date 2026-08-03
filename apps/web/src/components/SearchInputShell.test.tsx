import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { SearchInputShell } from './SearchInputShell'

afterEach(cleanup)

test('provides the homepage search design tokens while forwarding input behavior', () => {
  render(<SearchInputShell aria-label="搜索测试" name="q" value="相机" readOnly />)

  const input = screen.getByRole('searchbox', { name: '搜索测试' })
  expect(input).toHaveValue('相机')
  expect(input).toHaveClass(
    'h-11',
    'w-full',
    'block',
    'text-body',
    'font-normal',
    'focus-visible:outline-none',
  )
  expect(screen.getByTestId('search-input-shell')).toHaveClass(
    'min-h-12',
    'rounded-control',
    'border-line',
    'bg-surface',
    'focus-within:border-brand',
  )
  expect(screen.getByTestId('search-input-shell').querySelector('.app-icon')).toHaveClass(
    'absolute',
    'pointer-events-none',
  )
})
