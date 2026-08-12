import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { CaptureState } from './CaptureStates'

afterEach(cleanup)

test('AI pending and after-add states remove only the submitted item', () => {
  const { rerender } = render(<CaptureState state="ai-pending" />)
  expect(screen.getByText('HDMI cable')).toBeVisible()
  expect(screen.getAllByRole('button', { name: 'Add to list' })).toHaveLength(3)
  expect(screen.getByText('3 items pending')).toBeVisible()

  rerender(<CaptureState state="ai-after-add" />)
  expect(screen.queryByText('HDMI cable')).not.toBeInTheDocument()
  expect(screen.getByText('2 items pending')).toBeVisible()
  expect(screen.getByText(/1 item submitted and being added in the background/i)).toBeVisible()
  expect(screen.getByText('White power adapter')).toBeVisible()
  expect(screen.queryByText(/search/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/review/i)).not.toBeInTheDocument()
})

test('box details and scanner states contain only controlled product data', () => {
  const { rerender } = render(<CaptureState state="box-details" />)
  expect(screen.getByRole('heading', { name: 'Nomo Box · Box details' })).toBeVisible()
  expect(screen.getByText('HDMI cable')).toBeVisible()
  expect(screen.getByText('1 type')).toBeVisible()

  rerender(<CaptureState state="scanner" />)
  expect(screen.getByRole('heading', { name: 'Scan to view' })).toBeVisible()
  expect(screen.getByLabelText('QR scanner view')).toBeVisible()
  expect(screen.getByRole('img', { name: 'Live scanner view of the labeled Box 1' })).toHaveAttribute('src', '/creative/box-1-closed-labeled-user.png')
})

test('camera and confirmation share one real packing photo with explicit choices', () => {
  const { rerender } = render(<CaptureState state="camera-capture" />)
  expect(screen.getByRole('heading', { name: 'Take a photo' })).toBeVisible()
  expect(screen.getByLabelText('Camera preview of the packed Box 1')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Take photo' })).toBeVisible()

  rerender(<CaptureState state="photo-confirmation" />)
  expect(screen.getByLabelText('Captured photo of the packed Box 1')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Retake photo' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Use photo' })).toBeVisible()
})
