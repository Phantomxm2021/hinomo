import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { ResponsiveEditorDialog } from './ResponsiveEditorDialog'

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

test('renders a modal overlay and isolates the application', () => {
  render(
    <>
      <main data-app-shell>App</main>
      <ResponsiveEditorDialog open title="编辑" busy={false} onClose={vi.fn()}>
        <input aria-label="名称" />
      </ResponsiveEditorDialog>
    </>,
  )

  const dialog = screen.getByRole('dialog', { name: '编辑' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog).toHaveClass('rounded-t-[1.5rem]', 'lg:rounded-shell')
  expect(document.querySelector('[data-app-shell]')).toHaveAttribute('inert')
  expect(document.querySelector('[data-app-shell]')).toHaveAttribute('aria-hidden', 'true')
  expect(document.body.style.overflow).toBe('hidden')
  expect(dialog.parentElement).toHaveAttribute('data-testid', 'editor-dialog-backdrop')
})

test('blocks every dismissal path while busy', async () => {
  const onClose = vi.fn()
  const user = userEvent.setup()
  render(
    <ResponsiveEditorDialog open title="编辑" busy onClose={onClose}>
      <input aria-label="名称" />
    </ResponsiveEditorDialog>,
  )

  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: '关闭编辑' }))
  fireEvent.mouseDown(screen.getByTestId('editor-dialog-backdrop'))

  expect(screen.getByRole('dialog', { name: '编辑' })).toHaveAttribute('aria-busy', 'true')
  expect(onClose).not.toHaveBeenCalled()
})

test('focuses the requested control, wraps focus, and restores focus after close', async () => {
  const user = userEvent.setup()
  const opener = document.createElement('button')
  document.body.append(opener)
  opener.focus()
  const returnFocusRef = { current: opener }
  const view = render(
    <ResponsiveEditorDialog open title="编辑" busy={false} onClose={vi.fn()} initialFocusSelector="[name=title]" returnFocusRef={returnFocusRef}>
      <input name="title" aria-label="名称" />
      <button type="button">保存</button>
    </ResponsiveEditorDialog>,
  )

  const title = screen.getByRole('textbox', { name: '名称' })
  await waitFor(() => expect(title).toHaveFocus())
  await user.tab()
  expect(screen.getByRole('button', { name: '保存' })).toHaveFocus()
  await user.tab()
  expect(screen.getByRole('button', { name: '关闭编辑' })).toHaveFocus()
  await user.tab()
  expect(title).toHaveFocus()

  view.unmount()
  await waitFor(() => expect(opener).toHaveFocus())
  opener.remove()
})

test('does not restore focus when only busy state changes', async () => {
  const opener = document.createElement('button')
  document.body.append(opener)
  const returnFocusRef = { current: opener }
  const view = render(
    <ResponsiveEditorDialog open title="编辑" busy={false} onClose={vi.fn()} returnFocusRef={returnFocusRef}>
      <input aria-label="名称" />
    </ResponsiveEditorDialog>,
  )

  await waitFor(() => expect(screen.getByRole('textbox', { name: '名称' })).toHaveFocus())
  const focus = vi.spyOn(opener, 'focus')
  view.rerender(
    <ResponsiveEditorDialog open title="编辑" busy onClose={vi.fn()} returnFocusRef={returnFocusRef}>
      <input aria-label="名称" />
    </ResponsiveEditorDialog>,
  )

  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
  expect(focus).not.toHaveBeenCalled()
  focus.mockRestore()
  view.unmount()
  opener.remove()
})
