import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { MobileFeedbackProvider } from './MobileFeedbackProvider'
import { ResponsiveOperationError } from './ResponsiveOperationError'
import { useMobileFeedback } from './mobile-feedback'
import { I18nProvider } from '../i18n/I18nProvider'

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

test('normalizes a backend operation error into a shared Apple alert', () => {
  render(
    <I18nProvider>
      <MobileFeedbackProvider>
        <ResponsiveOperationError message="创建邀请失败" error={{ details: { code: 'venue_member_limit_reached' } }} />
      </MobileFeedbackProvider>
    </I18nProvider>,
  )

  const dialog = screen.getByRole('alertdialog', { name: '操作未完成' })
  expect(dialog).toHaveTextContent('创建邀请失败')
  expect(dialog).toHaveTextContent('成员名额已满；邀请链接不会占用名额')
})

test('does not offer retry for permission errors even when a retry callback exists', () => {
  render(
    <I18nProvider>
      <MobileFeedbackProvider>
        <ResponsiveOperationError message="保存箱子失败" error={{ code: 'venue_access_denied' }} onRetry={vi.fn()} />
      </MobileFeedbackProvider>
    </I18nProvider>,
  )

  const dialog = screen.getByRole('alertdialog', { name: '操作未完成' })
  expect(dialog).toHaveTextContent('你没有执行此操作的权限')
  expect(within(dialog).queryByRole('button', { name: '重试' })).not.toBeInTheDocument()
})

test('does not reopen a dismissed non-retryable error when the parent rerenders', () => {
  const view = render(
    <I18nProvider>
      <MobileFeedbackProvider>
        <ResponsiveOperationError message="保存箱子失败" error={{ code: 'venue_access_denied' }} onRetry={vi.fn()} />
      </MobileFeedbackProvider>
    </I18nProvider>,
  )

  const dialog = screen.getByRole('alertdialog', { name: '操作未完成' })
  fireEvent.click(within(dialog).getByRole('button', { name: '好' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

  view.rerender(
    <I18nProvider>
      <MobileFeedbackProvider>
        <ResponsiveOperationError message="保存箱子失败" error={{ code: 'venue_access_denied' }} onRetry={vi.fn()} />
      </MobileFeedbackProvider>
    </I18nProvider>,
  )
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('keeps retry available for an unknown operation error when a retry callback exists', () => {
  const retry = vi.fn()
  render(
    <I18nProvider>
      <MobileFeedbackProvider>
        <ResponsiveOperationError message="保存箱子失败" error={new Error('Unexpected database payload')} onRetry={retry} />
      </MobileFeedbackProvider>
    </I18nProvider>,
  )

  const dialog = screen.getByRole('alertdialog', { name: '操作未完成' })
  expect(within(dialog).getByRole('button', { name: '重试' })).toBeInTheDocument()
})
