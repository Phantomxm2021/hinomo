import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '../../components/AppIcon'
import type { BoxSummary } from '../boxes/boxes.api'
import type { ItemRecord } from '../items/items.api'
import { deriveItemAvailability, formatItemAvailability } from './item-movement-status'

export type ItemMovementCommand =
  | { action: 'take_out'; quantity: number; handlerLabel: string | null; note: string | null }
  | { action: 'return'; quantity: number; note: string | null }
  | { action: 'move'; targetBoxId: string; note: string | null }

type MovementAction = ItemMovementCommand['action']

export function ItemMovementSheet({ open, item, currentBoxId, boxes, pending, onClose, onEdit, onSubmit }: {
  open: boolean
  item: ItemRecord | null
  currentBoxId: string
  boxes: BoxSummary[]
  pending: boolean
  onClose: () => void
  onEdit: (item: ItemRecord) => void
  onSubmit: (command: ItemMovementCommand) => Promise<void>
}) {
  const [action, setAction] = useState<MovementAction | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [handlerLabel, setHandlerLabel] = useState('')
  const [note, setNote] = useState('')
  const [targetBoxId, setTargetBoxId] = useState('')
  const firstActionRef = useRef<HTMLButtonElement | null>(null)
  const status = item ? deriveItemAvailability(item.quantity, item.stored_quantity) : null
  const targetBoxes = useMemo(() => boxes.filter((box) => box.id !== currentBoxId), [boxes, currentBoxId])
  const targetBoxGroups = useMemo(() => {
    const groups = new Map<string, BoxSummary[]>()
    for (const box of targetBoxes) {
      const path = [box.venue_name, box.space_name].filter(Boolean).join(' · ') || '未分组'
      groups.set(path, [...(groups.get(path) ?? []), box])
    }
    return [...groups.entries()]
  }, [targetBoxes])

  useEffect(() => {
    if (!open || !item) return
    setAction(null)
    setQuantity(1)
    setHandlerLabel('')
    setNote('')
    setTargetBoxId('')
  }, [item, open])

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    firstActionRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [onClose, open, pending])

  if (!open || !item || !status) return null

  const maxQuantity = action === 'take_out' ? status.storedQuantity : status.outQuantity

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (action === 'take_out') {
      await onSubmit({
        action,
        quantity,
        handlerLabel: handlerLabel.trim() || null,
        note: note.trim() || null,
      })
    } else if (action === 'return') {
      await onSubmit({ action, quantity, note: note.trim() || null })
    } else if (action === 'move' && targetBoxId) {
      await onSubmit({ action, targetBoxId, note: note.trim() || null })
    }
  }

  const title = action === 'take_out' ? '取出物品' : action === 'return' ? '放回物品' : action === 'move' ? '移动物品' : item.name

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/30 backdrop-blur-[2px] lg:items-center lg:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose() }}>
      <section className="w-full max-w-lg rounded-t-[1.5rem] border-line bg-surface px-5 pt-3 pb-[max(1.25rem,var(--safe-area-bottom))] shadow-float lg:rounded-shell lg:border lg:p-6" role="dialog" aria-modal="true" aria-busy={pending} aria-labelledby="item-movement-title">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line lg:hidden" aria-hidden="true" />
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="m-0 truncate text-section-title font-bold" id="item-movement-title">{title}</h2>
            <p className="mt-1 text-sm font-semibold text-muted">{formatItemAvailability(status)}</p>
          </div>
          <button className="grid size-11 shrink-0 place-items-center rounded-control border border-line bg-canvas" type="button" aria-label="关闭物品操作" disabled={pending} onClick={onClose}><AppIcon name="close" /></button>
        </div>

        {!action ? (
          <div className="grid gap-2">
            <button ref={status.storedQuantity > 0 ? firstActionRef : undefined} className="flex min-h-14 items-center justify-between rounded-control bg-canvas px-4 text-left font-bold disabled:opacity-40" type="button" disabled={status.storedQuantity === 0} onClick={() => setAction('take_out')}><span>取出</span><span className="text-sm text-muted">最多 {status.storedQuantity} 件</span></button>
            <button ref={status.storedQuantity === 0 ? firstActionRef : undefined} className="flex min-h-14 items-center justify-between rounded-control bg-canvas px-4 text-left font-bold disabled:opacity-40" type="button" disabled={status.outQuantity === 0} onClick={() => setAction('return')}><span>放回</span><span className="text-sm text-muted">待归还 {status.outQuantity} 件</span></button>
            <button className="flex min-h-14 items-center justify-between rounded-control bg-canvas px-4 text-left font-bold disabled:opacity-40" type="button" disabled={status.outQuantity > 0 || targetBoxes.length === 0} onClick={() => setAction('move')}><span>移动到其他箱子</span><AppIcon className="text-muted" name="chevron-right" /></button>
            <button className="mt-2 min-h-12 rounded-control border border-line bg-surface px-4 font-bold" type="button" onClick={() => onEdit(item)}>编辑物品信息</button>
          </div>
        ) : (
          <form className="grid gap-3" onSubmit={(event) => void submit(event)}>
            {action === 'move' ? (
              <>
                <label className="font-bold" htmlFor="movement-target-box">目标箱子</label>
                <select className="min-h-12 rounded-control border border-line bg-surface px-3" id="movement-target-box" value={targetBoxId} required disabled={pending} onChange={(event) => setTargetBoxId(event.target.value)}>
                  <option value="">选择目标箱子</option>
                  {targetBoxGroups.map(([path, groupedBoxes]) => (
                    <optgroup label={path} key={path}>
                      {groupedBoxes.map((box) => <option value={box.id} key={box.id}>{path} · {box.name}</option>)}
                    </optgroup>
                  ))}
                </select>
                <p className="text-sm text-muted">将移动该物品的全部 {item.quantity} 件。</p>
              </>
            ) : (
              <>
                <label className="font-bold" htmlFor="movement-quantity">数量</label>
                <div className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] items-center overflow-hidden rounded-control border border-line bg-surface">
                  <button className="grid min-h-12 place-items-center" type="button" aria-label="减少操作数量" disabled={pending || quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}><AppIcon name="minus" /></button>
                  <input className="h-12 min-w-0 border-x border-y-0 border-line bg-transparent text-center font-bold" id="movement-quantity" inputMode="numeric" type="number" min="1" max={maxQuantity} value={quantity} required readOnly={pending} onChange={(event) => setQuantity(Math.min(maxQuantity, Math.max(1, Number(event.target.value) || 1)))} />
                  <button className="grid min-h-12 place-items-center" type="button" aria-label="增加操作数量" disabled={pending || quantity >= maxQuantity} onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}><AppIcon name="plus" /></button>
                </div>
              </>
            )}
            {action === 'take_out' ? (
              <>
                <label className="font-bold" htmlFor="movement-handler">经手人或用途（可选）</label>
                <input className="min-h-12 rounded-control border border-line bg-surface px-3" id="movement-handler" maxLength={120} value={handlerLabel} readOnly={pending} onChange={(event) => setHandlerLabel(event.target.value)} />
              </>
            ) : null}
            <label className="font-bold" htmlFor="movement-note">备注（可选）</label>
            <textarea className="min-h-20 resize-y rounded-control border border-line bg-surface px-3 py-2" id="movement-note" maxLength={500} value={note} readOnly={pending} onChange={(event) => setNote(event.target.value)} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button className="min-h-12 rounded-control border border-line font-bold" type="button" disabled={pending} onClick={() => setAction(null)}>返回</button>
              <button className="min-h-12 rounded-control bg-brand px-4 font-bold text-white disabled:opacity-50" type="submit" disabled={pending || (action === 'move' && !targetBoxId)}>{pending ? '处理中…' : action === 'take_out' ? '确认取出' : action === 'return' ? '确认放回' : '确认移动'}</button>
            </div>
          </form>
        )}
      </section>
    </div>,
    document.body,
  )
}
