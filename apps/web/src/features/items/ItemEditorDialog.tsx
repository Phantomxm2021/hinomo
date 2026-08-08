import { type RefObject, useState } from 'react'
import { ResponsiveEditorDialog } from '../../components/ResponsiveEditorDialog'
import { useI18n } from '../../i18n/I18nProvider'
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
  const { t } = useI18n()
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
      title={item ? t('itemForm.editTitle') : t('itemForm.createTitle')}
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
