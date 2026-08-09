import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { MobileFeedbackProvider } from './MobileFeedbackProvider'
import { ResponsiveOperationError } from './ResponsiveOperationError'
import { useMobileFeedback } from './mobile-feedback'

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

  expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument()

  view.rerender(
    <MobileFeedbackProvider>
      <ResponsiveOperationError message="刷新失败" onRetry={retry} retryLabel="重新加载" busy />
    </MobileFeedbackProvider>,
  )

  const retrying = screen.getByRole('button', { name: '重试中…' })
  expect(retrying).toBeDisabled()
  expect(retrying).toHaveAttribute('aria-busy', 'true')
  const cancel = screen.getByRole('button', { name: '取消' })
  expect(cancel).toHaveFocus()
  fireEvent.keyDown(cancel, { key: 'Tab' })
  expect(cancel).toHaveFocus()
})

function UnrelatedAlertTrigger() {
  const feedback = useMobileFeedback()
  return <button type="button" onClick={() => feedback.error({ key: 'unrelated', owner: 'unrelated-owner', title: '独立错误' })}>显示独立错误</button>
}

test('does not reopen a dismissed message when the parent rerenders', () => {
  const view = render(
    <MobileFeedbackProvider>
      <ResponsiveOperationError message="刷新失败" onRetry={vi.fn()} />
    </MobileFeedbackProvider>,
  )

  fireEvent.click(screen.getByRole('button', { name: '取消' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  view.rerender(
    <MobileFeedbackProvider>
      <ResponsiveOperationError message="刷新失败" onRetry={vi.fn()} />
    </MobileFeedbackProvider>,
  )
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('reopens the alert when a retry fails while the source remains mounted', async () => {
  const retry = vi.fn()
  const view = render(
    <MobileFeedbackProvider>
      <ResponsiveOperationError message="刷新失败" onRetry={retry} />
    </MobileFeedbackProvider>,
  )

  fireEvent.click(screen.getByRole('button', { name: '重试' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  view.rerender(
    <MobileFeedbackProvider>
      <ResponsiveOperationError message="刷新失败" onRetry={retry} busy />
    </MobileFeedbackProvider>,
  )
  await waitFor(() => expect(screen.getByRole('alertdialog', { name: '刷新失败' })).toBeInTheDocument())
})

test('unmounting an operation error cannot dismiss another owner’s alert', () => {
  const view = render(
    <MobileFeedbackProvider>
      <ResponsiveOperationError message="刷新失败" onRetry={vi.fn()} />
      <UnrelatedAlertTrigger />
    </MobileFeedbackProvider>,
  )

  fireEvent.click(screen.getByRole('button', { name: '显示独立错误' }))
  expect(screen.getByRole('alertdialog', { name: '独立错误' })).toBeInTheDocument()
  view.rerender(
    <MobileFeedbackProvider>
      <UnrelatedAlertTrigger />
    </MobileFeedbackProvider>,
  )
  expect(screen.getByRole('alertdialog', { name: '独立错误' })).toBeInTheDocument()
})
