import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { MobileFeedbackProvider } from './MobileFeedbackProvider'
import { useMobileFeedback } from './mobile-feedback'
import { SYSTEM_ACTION_SHEET_Z_INDEX, SYSTEM_ALERT_Z_INDEX, SYSTEM_NOTICE_Z_INDEX } from './overlay-layers'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  document.body.style.overflow = ''
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
      <button type="button" onClick={() => feedback.confirm({ title: '删除箱子', message: '此操作无法撤销', primaryLabel: '删除', cancelLabel: '取消', onPrimary: vi.fn() })}>确认操作</button>
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

test('presents blocking failures as a mobile alert with retry and cancel', () => {
  render(<MobileFeedbackProvider><Harness /></MobileFeedbackProvider>)
  fireEvent.click(screen.getByRole('button', { name: '错误' }))

  const dialog = screen.getByRole('alertdialog', { name: '加载失败' })
  expect(dialog).toHaveTextContent('请检查网络')
  expect(dialog.parentElement).toHaveClass('isolate')
  expect(dialog.parentElement).toHaveStyle({ zIndex: String(SYSTEM_ALERT_Z_INDEX) })
  expect(screen.getByRole('button', { name: '重试' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: '取消' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('renders one Apple alert at desktop width and restores focus after Escape', () => {
  window.innerWidth = 1280
  render(<MobileFeedbackProvider><Harness /></MobileFeedbackProvider>)
  const trigger = screen.getByRole('button', { name: '全局错误' })
  trigger.focus()
  fireEvent.click(trigger)

  expect(screen.getByRole('alertdialog', { name: '无法加载箱子' })).toBeInTheDocument()
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

test('supports cancel and primary actions through the shared confirmation alert', () => {
  render(<MobileFeedbackProvider><Harness /></MobileFeedbackProvider>)
  fireEvent.click(screen.getByRole('button', { name: '确认操作' }))

  expect(screen.getByRole('alertdialog', { name: '删除箱子' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '删除' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: '取消' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
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
