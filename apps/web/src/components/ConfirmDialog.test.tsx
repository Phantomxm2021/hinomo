import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

afterEach(cleanup)

const defaultProps = {
  open: true,
  title: '删除箱子？',
  description: '此操作无法恢复。',
  onCancel: vi.fn(),
  onConfirm: vi.fn(),
}

test('associates the alertdialog with its description', () => {
  render(<ConfirmDialog {...defaultProps} />)

  const dialog = screen.getByRole('alertdialog', { name: '删除箱子？' })
  const description = within(dialog).getByText('此操作无法恢复。')
  expect(dialog).toHaveAttribute('aria-describedby', description.id)
})

test('focuses the safe cancel action when opened', async () => {
  render(<ConfirmDialog {...defaultProps} />)

  await waitFor(() => expect(screen.getByRole('button', { name: '取消' })).toHaveFocus())
})

test('wraps Tab from confirm back to cancel', async () => {
  const user = userEvent.setup()
  render(<ConfirmDialog {...defaultProps} />)
  const cancel = screen.getByRole('button', { name: '取消' })
  const confirm = screen.getByRole('button', { name: '确认删除' })

  confirm.focus()
  await user.tab()

  expect(cancel).toHaveFocus()
})

test('wraps Shift+Tab from cancel back to confirm', async () => {
  const user = userEvent.setup()
  render(<ConfirmDialog {...defaultProps} />)
  const cancel = screen.getByRole('button', { name: '取消' })
  const confirm = screen.getByRole('button', { name: '确认删除' })

  cancel.focus()
  await user.tab({ shift: true })

  expect(confirm).toHaveFocus()
})

test('Escape cancels an idle dialog', async () => {
  const user = userEvent.setup()
  const onCancel = vi.fn()
  render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />)

  await user.keyboard('{Escape}')

  expect(onCancel).toHaveBeenCalledTimes(1)
})

test('busy state blocks cancellation, confirmation, and Escape', () => {
  const onCancel = vi.fn()
  const onConfirm = vi.fn()
  render(<ConfirmDialog {...defaultProps} busy onCancel={onCancel} onConfirm={onConfirm} />)
  const dialog = screen.getByRole('alertdialog')

  expect(screen.getByRole('button', { name: '取消' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '处理中…' })).toBeDisabled()
  fireEvent.keyDown(dialog, { key: 'Escape' })

  expect(onCancel).not.toHaveBeenCalled()
  expect(onConfirm).not.toHaveBeenCalled()
})

function BusyTransitionHarness() {
  const [busy, setBusy] = useState(false)

  return (
    <>
      <ConfirmDialog
        open
        title="删除箱子？"
        description="此操作无法恢复。"
        busy={busy}
        onCancel={vi.fn()}
        onConfirm={() => setBusy(true)}
      />
      <button type="button">页面后台操作</button>
    </>
  )
}

test('keeps focus inside the dialog when confirmation transitions to busy', async () => {
  const user = userEvent.setup()
  render(<BusyTransitionHarness />)

  await user.click(screen.getByRole('button', { name: '确认删除' }))
  const dialog = screen.getByRole('alertdialog')
  expect(screen.getByRole('button', { name: '处理中…' })).toBeDisabled()

  await user.tab()
  expect(dialog).toHaveFocus()
  expect(screen.getByRole('button', { name: '页面后台操作' })).not.toHaveFocus()

  await user.keyboard('{Escape}')
  expect(dialog).toBeInTheDocument()
})

test('renders an inline error inside the alertdialog', () => {
  render(<ConfirmDialog {...defaultProps} error="删除失败，请稍后重试" />)

  const dialog = screen.getByRole('alertdialog')
  expect(within(dialog).getByRole('alert')).toHaveTextContent('删除失败，请稍后重试')
})

function ReturnFocusHarness() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>打开删除确认</button>
      <ConfirmDialog
        open={open}
        title="删除箱子？"
        description="此操作无法恢复。"
        returnFocusRef={triggerRef}
        onCancel={() => setOpen(false)}
        onConfirm={vi.fn()}
      />
    </>
  )
}

test('restores focus to the supplied trigger after cancel closes the dialog', async () => {
  const user = userEvent.setup()
  render(<ReturnFocusHarness />)
  const trigger = screen.getByRole('button', { name: '打开删除确认' })

  await user.click(trigger)
  await user.click(screen.getByRole('button', { name: '取消' }))

  await waitFor(() => expect(trigger).toHaveFocus())
})
