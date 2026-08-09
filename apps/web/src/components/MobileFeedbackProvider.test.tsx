import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { MobileFeedbackProvider } from './MobileFeedbackProvider'
import { useMobileFeedback } from './mobile-feedback'
import { SYSTEM_ACTION_SHEET_Z_INDEX, SYSTEM_ALERT_Z_INDEX, SYSTEM_NOTICE_Z_INDEX } from './overlay-layers'

const initialViewportWidth = window.innerWidth

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  document.body.style.overflow = ''
  window.innerWidth = initialViewportWidth
  window.dispatchEvent(new Event('resize'))
})

function Harness() {
  const feedback = useMobileFeedback()
  return (
    <>
      <button type="button" onClick={() => feedback.notify('已创建箱子')}>通知</button>
      <button type="button" onClick={() => feedback.showAlert({ title: '加载失败', message: '请检查网络', primaryLabel: '重试', onPrimary: vi.fn(), cancelLabel: '取消' })}>错误</button>
      <button type="button" onClick={() => feedback.showActionSheet({ title: '图片上传失败', actions: [{ label: '重试上传', onSelect: vi.fn() }, { label: '暂不上传', onSelect: vi.fn() }] })}>操作</button>
      <button type="button" onClick={() => feedback.error({ key: 'boxes.refresh', title: '无法加载箱子', message: '请检查网络', retry: vi.fn() })}>全局错误</button>
      <button type="button" onClick={() => feedback.error({ key: 'boxes.refresh', title: '无法加载箱子', message: '请检查网络', retry: vi.fn() })}>重复错误</button>
      <button type="button" onClick={() => feedback.error({ key: 'spaces.save', title: '无法保存空间', message: '请稍后重试' })}>空间错误</button>
      <button type="button" onClick={() => feedback.confirm({ title: '删除箱子', message: '此操作无法撤销', primaryLabel: '删除', cancelLabel: '取消', onPrimary: vi.fn() })}>确认操作</button>
      <button type="button" onClick={() => feedback.confirm({ title: '异步失败', primaryLabel: '提交', cancelLabel: '取消', onPrimary: () => Promise.reject(new Error('primary failed')), onActionError: vi.fn() })}>异步主操作</button>
      <button type="button" onClick={() => feedback.confirm({ title: '异步取消失败', primaryLabel: '提交', cancelLabel: '取消', onCancel: () => Promise.reject(new Error('cancel failed')), onActionError: vi.fn() })}>异步取消</button>
    </>
  )
}

test('shows and automatically dismisses an Apple-style notice capsule', () => {
  vi.useFakeTimers()
  render(<MobileFeedbackProvider><Harness /></MobileFeedbackProvider>)
  fireEvent.click(screen.getByRole('button', { name: '通知' }))

  expect(screen.getByRole('status')).toHaveTextContent('已创建箱子')
  expect(screen.getByRole('status')).toHaveAccessibleName('已创建箱子')
  expect(screen.getByRole('status')).toHaveClass('rounded-full', 'isolate')
  expect(screen.getByRole('status')).toHaveStyle({ zIndex: String(SYSTEM_NOTICE_Z_INDEX) })
  expect(screen.getByRole('status')).not.toHaveClass('lg:hidden')
  act(() => vi.advanceTimersByTime(5000))
  expect(screen.queryByText('已创建箱子')).not.toBeInTheDocument()
})

test('presents blocking failures as a mobile Apple alert with retry and cancel', () => {
  window.innerWidth = 375
  window.dispatchEvent(new Event('resize'))
  render(<MobileFeedbackProvider><Harness /></MobileFeedbackProvider>)
  fireEvent.click(screen.getByRole('button', { name: '错误' }))

  const dialog = screen.getByRole('alertdialog', { name: '加载失败' })
  expect(dialog).toHaveTextContent('请检查网络')
  expect(dialog.parentElement).toHaveClass('isolate')
  expect(dialog.parentElement).not.toHaveClass('lg:hidden')
  expect(dialog.parentElement).toHaveStyle({ zIndex: String(SYSTEM_ALERT_Z_INDEX) })
  expect(screen.getByRole('button', { name: '重试' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: '取消' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('renders one Apple alert at desktop width and restores focus after Escape', () => {
  window.innerWidth = 1280
  window.dispatchEvent(new Event('resize'))
  render(<MobileFeedbackProvider><Harness /></MobileFeedbackProvider>)
  const trigger = screen.getByRole('button', { name: '全局错误' })
  trigger.focus()
  fireEvent.click(trigger)

  const dialog = screen.getByRole('alertdialog', { name: '无法加载箱子' })
  expect(dialog).toBeInTheDocument()
  expect(dialog.parentElement).not.toHaveClass('lg:hidden')
  expect(screen.getByRole('button', { name: '重试' })).toHaveFocus()
  fireEvent.keyDown(document, { key: 'Escape' })

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

test('replaces an identical global error instead of stacking alert dialogs', () => {
  render(<MobileFeedbackProvider><Harness /></MobileFeedbackProvider>)
  fireEvent.click(screen.getByRole('button', { name: '全局错误' }))
  fireEvent.click(screen.getByRole('button', { name: '重复错误' }))

  expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
})

test('replaces a previous feature error with the latest feature error', () => {
  render(<MobileFeedbackProvider><Harness /></MobileFeedbackProvider>)
  fireEvent.click(screen.getByRole('button', { name: '全局错误' }))
  fireEvent.click(screen.getByRole('button', { name: '空间错误' }))

  expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
  expect(screen.getByRole('alertdialog', { name: '无法保存空间' })).toHaveTextContent('请稍后重试')
  expect(screen.queryByRole('alertdialog', { name: '无法加载箱子' })).not.toBeInTheDocument()
})

test('supports cancel and primary actions through the shared confirmation alert', () => {
  render(<MobileFeedbackProvider><Harness /></MobileFeedbackProvider>)
  fireEvent.click(screen.getByRole('button', { name: '确认操作' }))

  expect(screen.getByRole('alertdialog', { name: '删除箱子' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '删除' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: '取消' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('catches rejected async primary actions and keeps the alert open', async () => {
  render(<MobileFeedbackProvider><Harness /></MobileFeedbackProvider>)
  fireEvent.click(screen.getByRole('button', { name: '异步主操作' }))
  fireEvent.click(screen.getByRole('button', { name: '提交' }))

  await waitFor(() => expect(screen.getByRole('alertdialog', { name: '异步失败' })).toBeInTheDocument())
  expect(screen.getByRole('button', { name: '提交' })).toBeInTheDocument()
})

test('catches rejected async cancel actions and keeps the alert open', async () => {
  render(<MobileFeedbackProvider><Harness /></MobileFeedbackProvider>)
  fireEvent.click(screen.getByRole('button', { name: '异步取消' }))
  fireEvent.click(screen.getByRole('button', { name: '取消' }))

  await waitFor(() => expect(screen.getByRole('alertdialog', { name: '异步取消失败' })).toBeInTheDocument())
})

function AlertReplacementHarness({ pendingAction }: { pendingAction: () => Promise<void> }) {
  const feedback = useMobileFeedback()
  return (
    <>
      <button type="button" onClick={() => feedback.confirm({ key: 'alert-a', title: '提示 A', primaryLabel: '执行 A', onPrimary: pendingAction, onActionError: () => feedback.showAlert({ key: 'alert-a-error', title: 'A 操作失败' }) })}>打开 A</button>
      <button type="button" onClick={() => feedback.confirm({ key: 'alert-b', title: '提示 B', primaryLabel: '执行 B' })}>替换为 B</button>
    </>
  )
}

test('does not let a resolved async action from replaced alert A close alert B', async () => {
  let resolveA!: () => void
  const pendingAction = () => new Promise<void>((resolve) => { resolveA = resolve })
  render(<MobileFeedbackProvider><AlertReplacementHarness pendingAction={pendingAction} /></MobileFeedbackProvider>)

  fireEvent.click(screen.getByRole('button', { name: '打开 A' }))
  fireEvent.click(screen.getByRole('button', { name: '执行 A' }))
  expect(screen.getByRole('button', { name: '执行 A' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: '替换为 B' }))
  expect(screen.getByRole('alertdialog', { name: '提示 B' })).toBeInTheDocument()
  resolveA()

  await waitFor(() => expect(screen.getByRole('alertdialog', { name: '提示 B' })).toBeInTheDocument())
  expect(screen.getByRole('button', { name: '执行 B' })).not.toBeDisabled()
})

test('does not let a rejected async action from replaced alert A mutate alert B', async () => {
  let rejectA!: (error: Error) => void
  const pendingAction = () => new Promise<void>((_, reject) => { rejectA = reject })
  render(<MobileFeedbackProvider><AlertReplacementHarness pendingAction={pendingAction} /></MobileFeedbackProvider>)

  fireEvent.click(screen.getByRole('button', { name: '打开 A' }))
  fireEvent.click(screen.getByRole('button', { name: '执行 A' }))
  fireEvent.click(screen.getByRole('button', { name: '替换为 B' }))
  rejectA(new Error('A failed'))

  await waitFor(() => expect(screen.getByRole('alertdialog', { name: '提示 B' })).toBeInTheDocument())
  expect(screen.getByRole('button', { name: '执行 B' })).not.toBeDisabled()
})

test('presents recoverable upload choices in a safe-area action sheet', () => {
  render(<MobileFeedbackProvider><Harness /></MobileFeedbackProvider>)
  fireEvent.click(screen.getByRole('button', { name: '操作' }))

  const sheet = screen.getByRole('dialog', { name: '图片上传失败' })
  expect(sheet.parentElement).toHaveClass('items-end', 'pb-[max(0.5rem,var(--safe-area-bottom))]', 'isolate', 'lg:hidden')
  expect(sheet.parentElement).toHaveStyle({ zIndex: String(SYSTEM_ACTION_SHEET_Z_INDEX) })
  expect(screen.getByRole('button', { name: '重试上传' })).toHaveFocus()
  expect(screen.getByRole('button', { name: '暂不上传' })).toBeInTheDocument()
})
