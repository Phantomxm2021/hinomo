import { useCallback, useEffect, useState } from 'react'
import { ResponsiveEditorDialog } from '../../components/ResponsiveEditorDialog'
import { useI18n } from '../../i18n/I18nProvider'
import { BoxForm } from './BoxForm'
import type { CreatedBox } from './boxes.api'

export function CreateBoxModal({
  open,
  onClose,
  onCompleted,
  onBusyChange,
  onLimitReached,
}: {
  open: boolean
  onClose: () => void
  onCompleted: (box: CreatedBox) => void
  onBusyChange?: (busy: boolean) => void
  onLimitReached?: () => void
}) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)

  const changeBusy = useCallback((nextBusy: boolean) => {
    setBusy(nextBusy)
    onBusyChange?.(nextBusy)
  }, [onBusyChange])

  useEffect(() => {
    if (!open) return
    return () => onBusyChange?.(false)
  }, [onBusyChange, open])

  return (
    <ResponsiveEditorDialog open={open} title={t('boxes.create')} busy={busy} onClose={onClose} maxWidthClassName="max-w-3xl">
      <BoxForm presentation="modal" onBusyChange={changeBusy} onCompleted={onCompleted} onLimitReached={onLimitReached} />
    </ResponsiveEditorDialog>
  )
}
