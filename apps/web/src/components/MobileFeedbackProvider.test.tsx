import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { MobileFeedbackProvider } from './MobileFeedbackProvider'
import { useMobileFeedback } from './mobile-feedback'

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
    </>
  )
}

test('shows and automatically dismisses an Apple-style notice capsule', () => {
  vi.useFakeTimers()
  render(<MobileFeedbackProvider><Harness /></MobileFeedbackProvider>)
  fireEvent.click(screen.getByRole('button', { name: '通知' }))

  expect(screen.getByRole('status')).toHaveTextContent('已创建箱子')
  expect(screen.getByRole('status')).toHaveAccessibleName('已创建箱子')
  expect(screen.getByRole('status')).toHaveClass('rounded-full', 'z-[190]')
  expect(screen.getByRole('status')).not.toHaveClass('lg:hidden')
  act(() => vi.advanceTimersByTime(5000))
  expect(screen.queryByText('已创建箱子')).not.toBeInTheDocument()
})

test('presents blocking failures as a mobile alert with retry and cancel', () => {
  render(<MobileFeedbackProvider><Harness /></MobileFeedbackProvider>)
  fireEvent.click(screen.getByRole('button', { name: '错误' }))

  const dialog = screen.getByRole('alertdialog', { name: '加载失败' })
  expect(dialog).toHaveTextContent('请检查网络')
  expect(dialog.parentElement).toHaveClass('z-[200]')
  expect(screen.getByRole('button', { name: '重试' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: '取消' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('presents recoverable upload choices in a safe-area action sheet', () => {
  render(<MobileFeedbackProvider><Harness /></MobileFeedbackProvider>)
  fireEvent.click(screen.getByRole('button', { name: '操作' }))

  const sheet = screen.getByRole('dialog', { name: '图片上传失败' })
  expect(sheet.parentElement).toHaveClass('items-end', 'pb-[max(0.5rem,var(--safe-area-bottom))]', 'z-[200]', 'lg:hidden')
  expect(screen.getByRole('button', { name: '重试上传' })).toHaveFocus()
  expect(screen.getByRole('button', { name: '暂不上传' })).toBeInTheDocument()
})
