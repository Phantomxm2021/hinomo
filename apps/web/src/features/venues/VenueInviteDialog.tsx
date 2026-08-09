import QRCode from 'qrcode'
import { useEffect, useMemo, useState } from 'react'
import { ResponsiveEditorDialog } from '../../components/ResponsiveEditorDialog'
import { useMobileFeedback } from '../../components/mobile-feedback'
import { useI18n } from '../../i18n/I18nProvider'
import { classifyFeedbackError } from '../../lib/feedback-errors'
import { publicAppOrigin } from '../../lib/env'
import { revokeVenueInvite, type VenueInvite } from './venue-sharing.api'

export type VenueInviteDialogProps = {
  open: boolean
  invite: VenueInvite | null
  /** The owner clears the raw invite token from its state before closing the dialog. */
  onClose: () => void
}

export function VenueInviteDialog({ open, invite, onClose }: VenueInviteDialogProps) {
  const { t } = useI18n()
  const feedback = useMobileFeedback()
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sharePending, setSharePending] = useState(false)
  const [copyPending, setCopyPending] = useState(false)
  const [copied, setCopied] = useState(false)
  const inviteActionPending = sharePending || copyPending
  const inviteUrl = useMemo(() => invite ? `${publicAppOrigin().replace(/\/+$/, '')}/join/venue#token=${invite.token}` : null, [invite])

  useEffect(() => {
    let active = true
    setQrDataUrl(null)
    setCopied(false)
    if (!open || !inviteUrl) return () => { active = false }
    const generateQr = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(inviteUrl, { errorCorrectionLevel: 'M', margin: 2, width: 1024 })
        if (active) setQrDataUrl(dataUrl)
      } catch (error) {
        if (!active) return
        const classification = classifyFeedbackError(error)
        feedback.error({
          key: 'venue.invite.qr',
          title: t(classification.titleKey),
          message: t(classification.messageKey),
          retry: classification.retryable ? () => generateQr() : undefined,
        })
      }
    }
    void generateQr()
    return () => { active = false }
  }, [feedback, inviteUrl, open, t])

  async function copy() {
    if (!inviteUrl || busy || inviteActionPending) return
    setCopyPending(true)
    try {
      await window.navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
    } catch (error) {
      const classification = classifyFeedbackError(error)
      feedback.error({ key: 'venue.invite.copy', title: t(classification.titleKey), message: t(classification.messageKey), retry: classification.retryable ? () => copy() : undefined })
    } finally {
      setCopyPending(false)
    }
  }

  async function share() {
    if (!inviteUrl || busy || inviteActionPending) return
    if (typeof window.navigator.share !== 'function') {
      await copy()
      return
    }
    setSharePending(true)
    try {
      await window.navigator.share({ title: t('venueSharing.shareTitle'), text: t('venueSharing.shareText'), url: inviteUrl })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      const classification = classifyFeedbackError(error)
      feedback.error({ key: 'venue.invite.share', title: t(classification.titleKey), message: t(classification.messageKey), retry: classification.retryable ? () => share() : undefined })
    } finally {
      setSharePending(false)
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
      feedback.error({
        key: `venue.invite.revoke:${invite.invite_id}`,
        title: t(classification.titleKey),
        message: t(classification.messageKey),
        retry: classification.retryable ? () => revoke() : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  function confirmRevoke() {
    if (!invite || busy || inviteActionPending) return
    feedback.confirm({
      key: `venue.invite.revoke:${invite.invite_id}`,
      title: t('venueSharing.revokeConfirmTitle'),
      message: t('venueSharing.revokeHint'),
      primaryLabel: t('venueSharing.revoke'),
      cancelLabel: t('common.cancel'),
      onPrimary: revoke,
      onActionError: (error) => {
        const classification = classifyFeedbackError(error)
        feedback.error({
          key: `venue.invite.revoke:${invite.invite_id}:error`,
          title: t(classification.titleKey),
          message: t(classification.messageKey),
          retry: classification.retryable ? () => revoke() : undefined,
        })
      },
    })
  }

  return (
    <ResponsiveEditorDialog open={open} title={t('venueSharing.shareDialogTitle')} busy={busy} onClose={onClose} initialFocusSelector="button:not(:disabled)" maxWidthClassName="max-w-xl">
      <div className="grid gap-5">
        <p className="m-0 leading-6 text-muted">{t(invite?.reusable ? 'venueSharing.reusableInviteLimit' : 'venueSharing.inviteLimit')}</p>
        <div className="grid min-h-52 place-items-center rounded-card border border-line bg-white p-4">
          {qrDataUrl ? <img className="size-52 max-w-full object-contain" src={qrDataUrl} alt={t('venueSharing.qrAlt')} /> : <p role="status">{t('venueSharing.qrLoading')}</p>}
        </div>
        <div className="grid gap-3" data-testid="venue-invite-actions">
          <button className="order-first min-h-12 rounded-control bg-brand px-4 font-bold text-white shadow-soft transition hover:bg-brand-strong disabled:opacity-50" type="button" disabled={busy || inviteActionPending || !inviteUrl} onClick={() => void share()}>{t('venueSharing.share')}</button>
          <button className="min-h-12 rounded-control border border-line px-4 font-bold transition hover:bg-canvas disabled:opacity-50" type="button" disabled={busy || inviteActionPending || !inviteUrl} onClick={() => void copy()}>{copied ? t('venueSharing.copied') : t('venueSharing.copy')}</button>
        </div>
        <div className="grid gap-2 border-t border-line/70 pt-4" data-testid="venue-invite-danger-zone">
          <p className="m-0 text-xs leading-5 text-muted">{t('venueSharing.revokeHint')}</p>
          <button className="min-h-11 justify-self-end rounded-control px-3 font-bold text-danger transition hover:bg-danger/5 disabled:opacity-50" type="button" disabled={busy || inviteActionPending || !invite} onClick={confirmRevoke}>{busy ? t('venueSharing.revoking') : t('venueSharing.revoke')}</button>
        </div>
      </div>
    </ResponsiveEditorDialog>
  )
}
