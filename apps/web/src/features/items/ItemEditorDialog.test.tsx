import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, type PropsWithChildren } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { I18nProvider, useI18n } from '../../i18n/I18nProvider'
import type { ItemFormProps } from './ItemForm'
import { ItemEditorDialog } from './ItemEditorDialog'

vi.mock('./ItemForm', () => ({
  ItemForm: ({ onBusyChange, onCancel, onDelete, onSaved }: ItemFormProps) => (
    <div>
      <input id="item-name" aria-label="物品名称" />
      <button type="button" onClick={() => onBusyChange?.(true)}>开始保存</button>
      <button type="button" onClick={onCancel}>取消编辑</button>
      <button type="button" onClick={onDelete}>删除物品</button>
      <button type="button" onClick={onSaved}>完成保存</button>
    </div>
  ),
}))

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

function renderDialog(props: Partial<React.ComponentProps<typeof ItemEditorDialog>> = {}) {
  return render(
    <ItemEditorDialog
      open
      boxId="box-1"
      item={null}
      onClose={vi.fn()}
      onSaved={vi.fn()}
      {...props}
    />,
  )
}

test('selects a create or edit title and uses the responsive modal overlay', () => {
  const view = renderDialog()

  const createDialog = screen.getByRole('dialog', { name: '新增物品' })
  expect(createDialog.parentElement).toHaveClass('fixed', 'inset-0')
  expect(createDialog).toHaveClass('lg:rounded-shell', 'max-w-2xl')

  view.rerender(
    <ItemEditorDialog
      open
      boxId="box-1"
      item={{ id: 'item-1', name: '锤子', category: null, quantity: 1, description: null }}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  )
  expect(screen.getByRole('dialog', { name: '编辑物品' })).toBeInTheDocument()
})

test('focuses the item name instead of the hidden image input', async () => {
  renderDialog()

  await waitFor(() => expect(screen.getByRole('textbox', { name: '物品名称' })).toHaveFocus())
})

test('forwards form cancellation and saved callbacks', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const onSaved = vi.fn()
  renderDialog({ onClose, onSaved })

  await user.click(screen.getByRole('button', { name: '取消编辑' }))
  await user.click(screen.getByRole('button', { name: '完成保存' }))

  expect(onClose).toHaveBeenCalledOnce()
  expect(onSaved).toHaveBeenCalledOnce()
})

test('blocks editor dismissal while the item form is busy', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const onDelete = vi.fn()
  renderDialog({ onClose, onDelete })

  await user.click(screen.getByRole('button', { name: '开始保存' }))
  expect(screen.getByRole('dialog', { name: '新增物品' })).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByRole('button', { name: '关闭新增物品' })).toBeDisabled()
  await user.keyboard('{Escape}')
  fireEvent.mouseDown(screen.getByTestId('editor-dialog-backdrop'))
  await user.click(screen.getByRole('button', { name: '取消编辑' }))
  await user.click(screen.getByRole('button', { name: '删除物品' }))

  expect(onClose).not.toHaveBeenCalled()
  expect(onDelete).not.toHaveBeenCalled()
})

test('localizes the item editor title and close label in English', () => {
  function EnglishProvider({ children }: PropsWithChildren) {
    const { setLocale } = useI18n()
    useEffect(() => setLocale('en-US'), [setLocale])
    return <>{children}</>
  }
  render(
    <I18nProvider>
      <EnglishProvider>
        <ItemEditorDialog open boxId="box-1" item={null} onClose={vi.fn()} onSaved={vi.fn()} />
      </EnglishProvider>
    </I18nProvider>,
  )

  expect(screen.getByRole('dialog', { name: 'Add item' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Close Add item' })).toBeInTheDocument()
})
