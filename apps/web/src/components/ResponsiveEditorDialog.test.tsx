import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { MobileActionSheet } from './MobileActionSheet'
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

test('lets a topmost action sheet consume Escape before the editor', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  function OverlayHarness() {
    const [sheetOpen, setSheetOpen] = useState(true)
    return (
      <>
        <ResponsiveEditorDialog open title="编辑" busy={false} onClose={onClose}>
          <input aria-label="名称" />
        </ResponsiveEditorDialog>
        <MobileActionSheet open={sheetOpen} title="图片上传失败" actions={[{ label: '重试上传', onSelect: vi.fn() }]} onClose={() => setSheetOpen(false)} />
      </>
    )
  }
  const view = render(<OverlayHarness />)

  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog', { name: '图片上传失败' })).not.toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: '编辑' })).toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
  view.unmount()
})

test('ignores hidden system overlays when deciding which layer receives Escape', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(
    <>
      <div data-overlay-layer="action-sheet" style={{ display: 'none' }} />
      <ResponsiveEditorDialog open title="编辑" busy={false} onClose={onClose}>
        <input aria-label="名称" />
      </ResponsiveEditorDialog>
    </>,
  )

  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('falls back to the close button when the initial selector has no match', async () => {
  render(
    <ResponsiveEditorDialog open title="编辑" busy={false} onClose={vi.fn()} initialFocusSelector="#missing-field">
      <p>暂无可编辑字段</p>
    </ResponsiveEditorDialog>,
  )

  await waitFor(() => expect(screen.getByRole('button', { name: '关闭编辑' })).toHaveFocus())
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

test('keeps the dialog isolated when focus configuration changes while open', async () => {
  const firstOpener = document.createElement('button')
  const secondOpener = document.createElement('button')
  document.body.append(firstOpener, secondOpener)
  const firstReturnFocusRef = { current: firstOpener }
  const secondReturnFocusRef = { current: secondOpener }
  const view = render(
    <>
      <main data-app-shell>App</main>
      <ResponsiveEditorDialog open title="编辑" busy={false} onClose={vi.fn()} initialFocusSelector="[name=first]" returnFocusRef={firstReturnFocusRef}>
        <input name="first" aria-label="第一个字段" />
        <input name="second" aria-label="第二个字段" />
      </ResponsiveEditorDialog>
    </>,
  )

  const firstField = screen.getByRole('textbox', { name: '第一个字段' })
  await waitFor(() => expect(firstField).toHaveFocus())
  const firstFocus = vi.spyOn(firstOpener, 'focus')
  const secondFocus = vi.spyOn(secondOpener, 'focus')

  view.rerender(
    <>
      <main data-app-shell>App</main>
      <ResponsiveEditorDialog open title="编辑" busy={false} onClose={vi.fn()} initialFocusSelector="[name=second]" returnFocusRef={secondReturnFocusRef}>
        <input name="first" aria-label="第一个字段" />
        <input name="second" aria-label="第二个字段" />
      </ResponsiveEditorDialog>
    </>,
  )

  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
  expect(firstField).toHaveFocus()
  expect(document.querySelector('[data-app-shell]')).toHaveAttribute('inert')
  expect(document.body.style.overflow).toBe('hidden')
  expect(firstFocus).not.toHaveBeenCalled()
  expect(secondFocus).not.toHaveBeenCalled()
  firstFocus.mockRestore()
  secondFocus.mockRestore()
  view.unmount()
  firstOpener.remove()
  secondOpener.remove()
})

test('restores the latest return focus target when closed', async () => {
  const firstOpener = document.createElement('button')
  const secondOpener = document.createElement('button')
  document.body.append(firstOpener, secondOpener)
  const firstReturnFocusRef = { current: firstOpener }
  const secondReturnFocusRef = { current: secondOpener }
  const view = render(
    <ResponsiveEditorDialog open title="编辑" busy={false} onClose={vi.fn()} returnFocusRef={firstReturnFocusRef}>
      <input aria-label="名称" />
    </ResponsiveEditorDialog>,
  )

  await waitFor(() => expect(screen.getByRole('textbox', { name: '名称' })).toHaveFocus())
  view.rerender(
    <ResponsiveEditorDialog open title="编辑" busy={false} onClose={vi.fn()} returnFocusRef={secondReturnFocusRef}>
      <input aria-label="名称" />
    </ResponsiveEditorDialog>,
  )
  view.rerender(
    <ResponsiveEditorDialog open={false} title="编辑" busy={false} onClose={vi.fn()} returnFocusRef={secondReturnFocusRef}>
      <input aria-label="名称" />
    </ResponsiveEditorDialog>,
  )

  await waitFor(() => expect(secondOpener).toHaveFocus())
  expect(firstOpener).not.toHaveFocus()
  view.unmount()
  firstOpener.remove()
  secondOpener.remove()
})
