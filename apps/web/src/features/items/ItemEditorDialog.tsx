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
  onBusyChange?: (busy: boolean) => void
}

export function ItemEditorDialog({
  open,
  boxId,
  item,
  returnFocusRef,
  onClose,
  onSaved,
  onDelete,
  onBusyChange,
}: ItemEditorDialogProps) {
  const [busy, setBusy] = useState(false)
  const changeBusy = (nextBusy: boolean) => {
    setBusy(nextBusy)
    onBusyChange?.(nextBusy)
  }
  const close = () => {
    if (!busy) onClose()
  }
  const deleteItem = () => {
    if (!busy) onDelete?.()
  }

  return (
    <ResponsiveEditorDialog
      open={open}
      title={item ? '编辑物品' : '新增物品'}
      busy={busy}
      onClose={close}
      returnFocusRef={returnFocusRef}
      initialFocusSelector="#item-name"
      maxWidthClassName="max-w-2xl"
    >
      <ItemForm
        key={item ? `edit-${item.id}` : 'new'}
        boxId={boxId}
        item={item}
        showHeading={false}
        onBusyChange={changeBusy}
        onSaved={onSaved}
        onCancel={close}
        onDelete={onDelete ? deleteItem : undefined}
      />
    </ResponsiveEditorDialog>
  )
}
