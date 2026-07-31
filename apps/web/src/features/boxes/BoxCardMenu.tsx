import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import type { BoxSummary } from './boxes.api'

type BoxCardMenuProps = {
  box: BoxSummary
  open: boolean
  triggerRef: React.RefObject<HTMLButtonElement | null>
  onClose: (restoreFocus: boolean) => void
  onDelete: (box: BoxSummary, trigger: HTMLButtonElement | null) => void
}

export function BoxCardMenu({ box, open, triggerRef, onClose, onDelete }: BoxCardMenuProps) {
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
      <Link
        className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-bold text-ink no-underline hover:bg-canvas"
        to={`/app/boxes/${box.id}/edit`}
        aria-label={`编辑${box.name}`}
        onClick={() => onClose(false)}
      >
        <AppIcon name="edit" size={16} />
        编辑箱子
      </Link>
      <button
        className="inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-left text-sm font-bold text-danger hover:bg-danger/5"
        type="button"
        aria-label={`删除${box.name}`}
        onClick={() => {
          onDelete(box, triggerRef.current)
          onClose(false)
        }}
      >
        <AppIcon name="trash" size={16} />
        删除箱子
      </button>
    </div>
  )
}
