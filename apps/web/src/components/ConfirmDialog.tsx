type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确认删除',
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-5 backdrop-blur-sm" role="presentation">
      <section className="w-full max-w-sm rounded-shell border border-line bg-surface p-6 shadow-float" aria-labelledby="confirm-dialog-title" aria-modal="true" role="alertdialog">
        <h2 className="mb-2 text-section-title font-bold text-ink" id="confirm-dialog-title">{title}</h2>
        <p>{description}</p>
        <div className="mt-5 flex justify-end gap-2.5">
          <button className="min-h-11 rounded-control border border-line bg-canvas px-4 py-2 font-bold text-ink" type="button" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button className="min-h-11 rounded-control border border-danger bg-danger px-4 py-2 font-bold text-white" type="button" onClick={onConfirm} disabled={busy}>
            {busy ? '处理中…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
