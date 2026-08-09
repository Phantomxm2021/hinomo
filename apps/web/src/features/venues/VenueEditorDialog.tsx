import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '../../components/AppIcon'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { useI18n } from '../../i18n/I18nProvider'
import { createVenueSchema } from './venue.schema'
import type { VenueInput, VenueSummary } from './venues.api'

export function VenueEditorDialog({ open, venue, pending, error, onClose, onSubmit, onDelete }: {
  open: boolean
  venue: VenueSummary | null
  pending: boolean
  error: unknown | null
  onClose: () => void
  onSubmit: (input: VenueInput) => Promise<void>
  onDelete: (venue: VenueSummary) => Promise<void>
}) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [validationError, setValidationError] = useState<{ key: string; params?: Record<string, string | number | boolean> } | null>(null)
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
    const result = createVenueSchema(t).safeParse({ name, description })
    if (!result.success) {
      const issue = result.error.issues[0]
      const field = issue?.path[0] === 'description' ? 'description' : 'name'
      setValidationError(issue?.code === 'too_big'
        ? { key: field === 'name' ? 'validation.venueNameMax' : 'validation.descriptionMax' }
        : field === 'name'
          ? { key: 'venues.nameRequired' }
          : { key: 'validation.descriptionMax' })
      return
    }
    setValidationError(null)
    await onSubmit({ name: result.data.name, description: result.data.description || null })
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/30 p-0 backdrop-blur-[2px] lg:items-center lg:p-3" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose() }}>
      <section className="w-full max-w-lg rounded-t-[1.5rem] border-x-0 border-t border-b-0 border-line bg-surface p-5 pb-[max(1.25rem,var(--safe-area-bottom))] shadow-float lg:rounded-shell lg:border lg:p-6" role="dialog" aria-modal="true" aria-busy={pending} aria-labelledby="venue-editor-title">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="m-0 text-section-title font-bold" id="venue-editor-title">{venue ? t('venues.edit') : t('venues.create')}</h2>
          <button className="grid size-11 place-items-center rounded-control border border-line bg-canvas" type="button" aria-label={t('venues.closeEditor')} disabled={pending} onClick={onClose}><AppIcon name="close" /></button>
        </div>
        <form className="grid gap-3" onSubmit={(event) => void submit(event)}>
          <label className="font-bold" htmlFor="venue-name">{t('venues.name')}</label>
          <input className="min-h-12 rounded-control border border-line bg-surface px-3" id="venue-name" value={name} autoFocus readOnly={pending} onChange={(event) => setName(event.target.value)} />
          <label className="font-bold" htmlFor="venue-description">{t('venues.descriptionOptional')}</label>
          <textarea className="min-h-24 resize-y rounded-control border border-line bg-surface px-3 py-2" id="venue-description" value={description} readOnly={pending} onChange={(event) => setDescription(event.target.value)} />
          {validationError ? <p className="text-danger" role="alert">{t(validationError.key, validationError.params)}</p> : null}
          {error ? <ResponsiveOperationError message={t('venues.saveError')} error={error} /> : null}
          {defaultVenue ? <p className="text-sm text-muted">{t('venues.defaultHint')}</p> : null}
          {venue && venue.space_count > 0 ? <p className="text-sm text-muted">{t('venues.deleteBlocked', { count: venue.space_count })}</p> : null}
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {venue ? <button className="mr-auto min-h-11 rounded-control px-4 font-bold text-danger disabled:opacity-50" type="button" disabled={pending || defaultVenue || venue.space_count > 0} onClick={() => void onDelete(venue)}>{t('venues.delete')}</button> : null}
            <button className="min-h-11 rounded-control bg-brand px-5 font-bold text-white disabled:opacity-50" type="submit" disabled={pending}>{pending ? t('venues.saving') : venue ? t('venues.save') : t('venues.create')}</button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  )
}
