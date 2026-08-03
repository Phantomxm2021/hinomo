import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'

export function CreditGateSheet({
  open,
  availableCredits = 0,
  requiredCredits,
  onClose,
}: {
  open: boolean
  availableCredits?: number
  requiredCredits?: number
  onClose: () => void
}) {
  const navigate = useNavigate()
  const closeRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('keydown', close)
      document.body.style.overflow = overflow
      previousFocus?.focus()
    }
  }, [onClose, open])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 px-0 backdrop-blur-[2px] lg:items-center lg:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="w-full max-w-lg rounded-t-[1.75rem] bg-canvas px-5 pt-3 pb-[max(1.25rem,var(--safe-area-bottom))] shadow-float lg:rounded-[1.75rem] lg:p-7" role="alertdialog" aria-modal="true" aria-labelledby="credit-gate-title" aria-describedby="credit-gate-description">
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line lg:hidden" aria-hidden="true" />
        <div className="flex justify-end">
          <button ref={closeRef} className="grid size-11 place-items-center rounded-full bg-placeholder/70 text-muted active:opacity-60" type="button" aria-label="关闭额度提示" onClick={onClose}><AppIcon name="close" /></button>
        </div>
        <div className="grid justify-items-center px-3 pb-2 text-center">
          <div className="mb-5 grid size-20 place-items-center rounded-[1.45rem] bg-brand text-white shadow-soft"><AppIcon name="scan" size={36} /></div>
          <p className="mb-2 text-xs font-extrabold tracking-[0.16em] text-brand">AI CREDITS</p>
          <h2 className="m-0 text-[1.6rem] leading-tight font-extrabold text-ink" id="credit-gate-title">需要更多识别额度</h2>
          <p className="mt-3 max-w-sm text-[0.95rem] leading-6 text-muted" id="credit-gate-description">
            {`当前可用 ${availableCredits} credits${requiredCredits ? `，本次需要 ${requiredCredits}` : ''}。额度一次购买，不会自动续费。`}
          </p>
        </div>
        <button className="mt-5 min-h-13 w-full rounded-[0.95rem] bg-brand px-6 text-base font-extrabold text-white shadow-soft active:scale-[0.99]" type="button" onClick={() => { onClose(); navigate('/app/me/credits') }}>
          购买 credits
        </button>
        <button className="mt-2 min-h-11 w-full bg-transparent font-semibold text-muted" type="button" onClick={onClose}>暂不</button>
      </section>
    </div>,
    document.body,
  )
}
