import { useCallback, useEffect, useState, type RefObject } from 'react'
import { ResponsiveEditorDialog } from '../../components/ResponsiveEditorDialog'
import { BoxForm } from './BoxForm'

export function EditBoxModal({
  open,
  boxId,
  returnFocusRef,
  onClose,
  onSaved,
  onBusyChange,
}: {
  open: boolean
  boxId: string
  returnFocusRef?: RefObject<HTMLElement | null>
  onClose: () => void
  onSaved: () => void
  onBusyChange?: (busy: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const changeBusy = useCallback((nextBusy: boolean) => {
    setBusy(nextBusy)
    onBusyChange?.(nextBusy)
  }, [onBusyChange])

  useEffect(() => {
    if (!open) return
    return () => onBusyChange?.(false)
  }, [onBusyChange, open])

  useEffect(() => {
    if (open) return
    setBusy(false)
  }, [open])

  return (
    <ResponsiveEditorDialog
      open={open}
      title="编辑箱子"
      busy={busy}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      maxWidthClassName="max-w-3xl"
    >
      <BoxForm boxId={boxId} presentation="modal" onBusyChange={changeBusy} onSaved={onSaved} />
    </ResponsiveEditorDialog>
  )
}
