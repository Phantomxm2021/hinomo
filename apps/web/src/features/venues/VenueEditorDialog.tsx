import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '../../components/AppIcon'
import { venueSchema } from './venue.schema'
import type { VenueInput, VenueSummary } from './venues.api'

export function VenueEditorDialog({ open, venue, pending, error, onClose, onSubmit, onDelete }: {
  open: boolean
  venue: VenueSummary | null
  pending: boolean
  error: boolean
  onClose: () => void
  onSubmit: (input: VenueInput) => Promise<void>
  onDelete: (venue: VenueSummary) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const defaultVenue = Boolean(venue?.is_default)

  useEffect(() => {
    if (!open) return
    setName(venue?.name ?? '')
    setDescription(venue?.description ?? '')
    setValidationError(null)
  }, [open, venue])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose, open, pending])

  if (!open) return null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (defaultVenue) return
    const result = venueSchema.safeParse({ name, description })
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? '请检查场地信息')
      return
    }
    setValidationError(null)
    await onSubmit({ name: result.data.name, description: result.data.description || null })
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/45 p-3 sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose() }}>
      <section className="w-full max-w-lg rounded-shell border border-line bg-surface p-6 shadow-float" role="dialog" aria-modal="true" aria-busy={pending} aria-labelledby="venue-editor-title">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="m-0 text-section-title font-bold" id="venue-editor-title">{venue ? '编辑场地' : '创建场地'}</h2>
          <button className="grid size-11 place-items-center rounded-control border border-line bg-canvas" type="button" aria-label="关闭场地编辑器" disabled={pending} onClick={onClose}><AppIcon name="close" /></button>
        </div>
        <form className="grid gap-3" onSubmit={(event) => void submit(event)}>
          <label className="font-bold" htmlFor="venue-name">场地名称</label>
          <input className="min-h-12 rounded-control border border-line bg-surface px-3" id="venue-name" value={name} autoFocus readOnly={pending || defaultVenue} onChange={(event) => setName(event.target.value)} />
          <label className="font-bold" htmlFor="venue-description">描述（可选）</label>
          <textarea className="min-h-24 resize-y rounded-control border border-line bg-surface px-3 py-2" id="venue-description" value={description} readOnly={pending || defaultVenue} onChange={(event) => setDescription(event.target.value)} />
          {validationError ? <p className="text-danger" role="alert">{validationError}</p> : null}
          {error ? <p className="text-danger" role="alert">场地保存失败，请重试</p> : null}
          {defaultVenue ? <p className="text-sm text-muted">默认场地不可修改或删除。</p> : null}
          {venue && venue.space_count > 0 ? <p className="text-sm text-muted">该场地包含 {venue.space_count} 个空间，移走空间后才能删除。</p> : null}
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {venue ? <button className="mr-auto min-h-11 rounded-control px-4 font-bold text-danger disabled:opacity-50" type="button" disabled={pending || defaultVenue || venue.space_count > 0} onClick={() => void onDelete(venue)}>删除场地</button> : null}
            <button className="min-h-11 rounded-control border border-line px-4 font-bold" type="button" disabled={pending} onClick={onClose}>取消</button>
            <button className="min-h-11 rounded-control bg-brand px-5 font-bold text-white disabled:opacity-50" type="submit" disabled={pending || defaultVenue}>{pending ? '保存中…' : venue ? '保存场地' : '创建场地'}</button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  )
}
