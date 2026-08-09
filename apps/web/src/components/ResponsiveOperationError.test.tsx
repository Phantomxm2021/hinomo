import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { MobileFeedbackProvider } from './MobileFeedbackProvider'
import { ResponsiveOperationError } from './ResponsiveOperationError'

afterEach(cleanup)

test('adapts operation failures into one shared Apple alert and retries from its primary action', () => {
  const retry = vi.fn()
  render(
    <MobileFeedbackProvider>
      <ResponsiveOperationError message="刷新失败" onRetry={retry} />
    </MobileFeedbackProvider>,
  )

  expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: '重试' }))
  expect(retry).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('preserves custom retry text and disables the retry action while busy', () => {
  const retry = vi.fn()
  const view = render(
    <MobileFeedbackProvider>
      <ResponsiveOperationError message="刷新失败" onRetry={retry} retryLabel="重新加载" />
    </MobileFeedbackProvider>,
  )

  fireEvent.click(screen.getByRole('button', { name: '重新加载' }))
  expect(retry).toHaveBeenCalledTimes(1)

  view.rerender(
    <MobileFeedbackProvider>
      <ResponsiveOperationError message="刷新失败" onRetry={retry} retryLabel="重新加载" busy />
    </MobileFeedbackProvider>,
  )

  const retrying = screen.getByRole('button', { name: '重试中…' })
  expect(retrying).toBeDisabled()
  expect(retrying).toHaveAttribute('aria-busy', 'true')
})
