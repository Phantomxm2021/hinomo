import { useEffect, useRef } from 'react'
import { AppIcon } from '../../components/AppIcon'
import { useI18n } from '../../i18n/I18nProvider'
import type { BoxSummary } from './boxes.api'

type BoxCardMenuProps = {
  box: BoxSummary
  open: boolean
  triggerRef: React.RefObject<HTMLButtonElement | null>
  onClose: (restoreFocus: boolean) => void
  onEdit: (box: BoxSummary, trigger: HTMLButtonElement | null) => void
  onDelete: (box: BoxSummary, trigger: HTMLButtonElement | null) => void
  canDelete?: boolean
}

export function BoxCardMenu({ box, open, triggerRef, onClose, onEdit, onDelete, canDelete = true }: BoxCardMenuProps) {
  const { t } = useI18n()
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose(true)
    }
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      onClose(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [onClose, open, triggerRef])

  if (!open) return null

  return (
    <div ref={menuRef} className="absolute top-14 right-3 z-30 grid min-w-36 gap-1 rounded-control border border-line bg-surface p-1 shadow-float">
      <button
        className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-bold text-ink no-underline hover:bg-canvas"
        type="button"
        aria-label={t('boxes.editAria', { name: box.name })}
        onClick={() => {
          onEdit(box, triggerRef.current)
          onClose(false)
        }}
      >
        <AppIcon name="edit" size={16} />
        {t('boxes.edit')}
      </button>
      {canDelete ? <button
        className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-left text-sm font-bold text-danger hover:bg-danger/5"
        type="button"
        aria-label={t('boxes.deleteAria', { name: box.name })}
        onClick={() => {
          onDelete(box, triggerRef.current)
          onClose(false)
        }}
      >
        <AppIcon name="trash" size={16} />
        {t('boxes.delete')}
      </button> : null}
    </div>
  )
}
