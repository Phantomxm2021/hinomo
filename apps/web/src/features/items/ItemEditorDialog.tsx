import { type RefObject, useState } from 'react'
import { ResponsiveEditorDialog } from '../../components/ResponsiveEditorDialog'
import { ItemForm } from './ItemForm'
import type { ItemRecord } from './items.api'

export type ItemEditorDialogProps = {
  open: boolean
  boxId: string
  item: ItemRecord | null
  returnFocusRef?: RefObject<HTMLElement | null>
  onClose: () => void
  onSaved: () => void
  onDelete?: () => void
}

export function ItemEditorDialog({
  open,
  boxId,
  item,
  returnFocusRef,
  onClose,
  onSaved,
  onDelete,
}: ItemEditorDialogProps) {
  const [busy, setBusy] = useState(false)
  const close = () => {
    if (!busy) onClose()
  }

  return (
    <ResponsiveEditorDialog
      open={open}
      title={item ? '编辑物品' : '新增物品'}
      busy={busy}
      onClose={close}
      returnFocusRef={returnFocusRef}
      maxWidthClassName="max-w-2xl"
    >
      <ItemForm
        key={item ? `edit-${item.id}` : 'new'}
        boxId={boxId}
        item={item}
        showHeading={false}
        onBusyChange={setBusy}
        onSaved={onSaved}
        onCancel={close}
        onDelete={onDelete}
      />
    </ResponsiveEditorDialog>
  )
}
