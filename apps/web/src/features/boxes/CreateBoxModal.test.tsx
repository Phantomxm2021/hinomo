import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { CreateBoxModal } from './CreateBoxModal'

vi.mock('./BoxForm', () => ({
  BoxForm: ({ onBusyChange, onCompleted }: {
    onBusyChange?: (busy: boolean) => void
    onCompleted?: (box: { id: string }) => void
  }) => (
    <>
      <button type="button" onClick={() => onBusyChange?.(true)}>开始保存</button>
      <button type="button" onClick={() => onCompleted?.({ id: 'box-new' })}>完成创建</button>
    </>
  ),
}))

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

test('isolates the application and restores it when the create dialog unmounts', () => {
  const view = render(
    <>
      <main data-app-shell>application</main>
      <CreateBoxModal open onClose={vi.fn()} onCompleted={vi.fn()} />
    </>,
  )

  const appShell = document.querySelector('[data-app-shell]')
  expect(screen.getByRole('dialog', { name: '创建箱子' })).toHaveAttribute('aria-modal', 'true')
  expect(appShell).toHaveAttribute('inert')
  expect(appShell).toHaveAttribute('aria-hidden', 'true')
  expect(document.body.style.overflow).toBe('hidden')

  view.unmount()
  expect(appShell).not.toHaveAttribute('inert')
  expect(appShell).not.toHaveAttribute('aria-hidden')
  expect(document.body.style.overflow).toBe('')
})

test('supports normal dismissal but blocks every dismissal path while busy', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(
    <>
      <main data-app-shell>application</main>
      <CreateBoxModal open onClose={onClose} onCompleted={vi.fn()} />
    </>,
  )

  const dialog = screen.getByRole('dialog', { name: '创建箱子' })
  const backdrop = dialog.parentElement!
  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledTimes(1)
  fireEvent.mouseDown(backdrop)
  expect(onClose).toHaveBeenCalledTimes(2)
  await user.click(screen.getByRole('button', { name: '关闭创建箱子' }))
  expect(onClose).toHaveBeenCalledTimes(3)

  await user.click(screen.getByRole('button', { name: '开始保存' }))
  expect(screen.getByRole('button', { name: '关闭创建箱子' })).toBeDisabled()
  await user.keyboard('{Escape}')
  fireEvent.mouseDown(backdrop)
  expect(onClose).toHaveBeenCalledTimes(3)
})

test('does not render a dialog while closed', () => {
  render(<CreateBoxModal open={false} onClose={vi.fn()} onCompleted={vi.fn()} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('focuses the first field when asynchronous form content appears', async () => {
  render(<CreateBoxModal open onClose={vi.fn()} onCompleted={vi.fn()} />)
  const dialog = screen.getByRole('dialog', { name: '创建箱子' })
  const field = document.createElement('input')
  field.setAttribute('aria-label', '异步字段')

  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
  dialog.append(field)

  await waitFor(() => expect(field).toHaveFocus())
})

test('forwards the completed box through one callback', async () => {
  const user = userEvent.setup()
  const onCompleted = vi.fn()
  render(<CreateBoxModal open onClose={vi.fn()} onCompleted={onCompleted} />)

  await user.click(screen.getByRole('button', { name: '完成创建' }))

  expect(onCompleted).toHaveBeenCalledTimes(1)
  expect(onCompleted).toHaveBeenCalledWith({ id: 'box-new' })
})
