import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { CaptureState } from './CaptureStates'

afterEach(cleanup)

test('pre-add and post-add states differ only by promoted item visibility', () => {
  const { rerender } = render(<CaptureState state="ai-before" />)
  expect(screen.getByText('HDMI cable')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Add to list' })).toBeVisible()

  rerender(<CaptureState state="ai-after" />)
  expect(screen.queryByText('HDMI cable')).not.toBeInTheDocument()
  expect(screen.getByText('HDMI cable added to Box 1')).toBeVisible()
  expect(screen.getByText('Power adapter')).toBeVisible()
  expect(screen.queryByText(/search/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/review/i)).not.toBeInTheDocument()
})

test('inventory and scanner states contain only controlled product data', () => {
  const { rerender } = render(<CaptureState state="inventory" />)
  expect(screen.getByRole('heading', { name: 'Box 1' })).toBeVisible()
  expect(screen.getByText('HDMI cable')).toBeVisible()
  expect(screen.getByText('Power adapter')).toBeVisible()
  expect(screen.getByText('Tape measure')).toBeVisible()
  expect(screen.getByText('3 total')).toBeVisible()

  rerender(<CaptureState state="scanner" />)
  expect(screen.getByRole('heading', { name: 'Scan to view' })).toBeVisible()
  expect(screen.getByLabelText('QR scanner view')).toBeVisible()
})

test('capture state uses the real packing action language', () => {
  render(<CaptureState state="capture" />)
  expect(screen.getByRole('heading', { name: 'AI packing' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Take a photo of this item' })).toBeVisible()
  expect(screen.getByText('BX-001 · Box 1 · 0 photos')).toBeVisible()
})
