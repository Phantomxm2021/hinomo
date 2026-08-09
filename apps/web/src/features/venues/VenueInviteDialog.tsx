import QRCode from 'qrcode'
import { useEffect, useMemo, useState } from 'react'
import { ResponsiveEditorDialog } from '../../components/ResponsiveEditorDialog'
import { useMobileFeedback } from '../../components/mobile-feedback'
import { useI18n } from '../../i18n/I18nProvider'
import { classifyFeedbackError } from '../../lib/feedback-errors'
import { publicAppOrigin } from '../../lib/env'
import { revokeVenueInvite } from './venue-sharing.api'

export type VenueInviteDialogProps = {
  open: boolean
  invite: { invite_id: string; token: string; expires_at: string } | null
  /** The owner clears the raw invite token from its state before closing the dialog. */
  onClose: () => void
}

export function VenueInviteDialog({ open, invite, onClose }: VenueInviteDialogProps) {
  const { t } = useI18n()
  const feedback = useMobileFeedback()
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const inviteUrl = useMemo(() => invite ? `${publicAppOrigin().replace(/\/+$/, '')}/join/venue#token=${invite.token}` : null, [invite])

  useEffect(() => {
    let active = true
    setQrDataUrl(null)
    setCopied(false)
    if (!open || !inviteUrl) return () => { active = false }
    void QRCode.toDataURL(inviteUrl, { errorCorrectionLevel: 'M', margin: 2, width: 1024 })
      .then((dataUrl) => { if (active) setQrDataUrl(dataUrl) })
      .catch((error) => {
        if (!active) return
        const classification = classifyFeedbackError(error)
        feedback.error({ key: 'venue.invite.qr', title: t(classification.titleKey), message: t(classification.messageKey) })
      })
    return () => { active = false }
  }, [feedback, inviteUrl, open, t])

  async function copy() {
    if (!inviteUrl || busy) return
    try {
      await window.navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
    } catch (error) {
      const classification = classifyFeedbackError(error)
      feedback.error({ key: 'venue.invite.copy', title: t(classification.titleKey), message: t(classification.messageKey) })
    }
  }

  async function share() {
    if (!inviteUrl || busy) return
    if (typeof window.navigator.share !== 'function') {
      await copy()
      return
    }
    try {
      await window.navigator.share({ title: t('venueSharing.shareTitle'), text: t('venueSharing.shareText'), url: inviteUrl })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      const classification = classifyFeedbackError(error)
      feedback.error({ key: 'venue.invite.share', title: t(classification.titleKey), message: t(classification.messageKey) })
    }
  }

  async function revoke() {
    if (!invite || busy) return
    setBusy(true)
    try {
      await revokeVenueInvite(invite.invite_id)
      onClose()
    } catch (error) {
      const classification = classifyFeedbackError(error)
      feedback.error({ key: `venue.invite.revoke:${invite.invite_id}`, title: t(classification.titleKey), message: t(classification.messageKey) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <ResponsiveEditorDialog open={open} title={t('venueSharing.shareDialogTitle')} busy={busy} onClose={onClose} initialFocusSelector="button:not(:disabled)" maxWidthClassName="max-w-xl">
      <div className="grid gap-5">
        <p className="m-0 leading-6 text-muted">{t('venueSharing.inviteLimit')}</p>
        <div className="grid min-h-52 place-items-center rounded-card border border-line bg-white p-4">
          {qrDataUrl ? <img className="size-52 max-w-full object-contain" src={qrDataUrl} alt={t('venueSharing.qrAlt')} /> : <p role="status">{t('venueSharing.qrLoading')}</p>}
        </div>
        <div className="grid gap-3" data-testid="venue-invite-actions">
          <button className="order-first min-h-12 rounded-control bg-brand px-4 font-bold text-white shadow-soft transition hover:bg-brand-strong disabled:opacity-50" type="button" disabled={busy || !inviteUrl} onClick={() => void share()}>{t('venueSharing.share')}</button>
          <button className="min-h-12 rounded-control border border-line px-4 font-bold transition hover:bg-canvas disabled:opacity-50" type="button" disabled={busy || !inviteUrl} onClick={() => void copy()}>{copied ? t('venueSharing.copied') : t('venueSharing.copy')}</button>
        </div>
        <div className="grid gap-2 border-t border-line/70 pt-4" data-testid="venue-invite-danger-zone">
          <p className="m-0 text-xs leading-5 text-muted">{t('venueSharing.revokeHint')}</p>
          <button className="min-h-11 justify-self-end rounded-control px-3 font-bold text-danger transition hover:bg-danger/5 disabled:opacity-50" type="button" disabled={busy || !invite} onClick={() => void revoke()}>{busy ? t('venueSharing.revoking') : t('venueSharing.revoke')}</button>
        </div>
      </div>
    </ResponsiveEditorDialog>
  )
}
