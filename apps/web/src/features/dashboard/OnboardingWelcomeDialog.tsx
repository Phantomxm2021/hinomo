import { type RefObject } from 'react'
import { ResponsiveEditorDialog } from '../../components/ResponsiveEditorDialog'
import { useI18n } from '../../i18n/I18nProvider'
import type { OnboardingProgress, OnboardingStep } from './onboarding-progress'

export type OnboardingWelcomeDialogProps = {
  open: boolean
  busy: boolean
  progress: OnboardingProgress
  actionHref?: string
  onClose: () => void
  onStart: (actionHref: string) => void
  returnFocusRef?: RefObject<HTMLElement | null>
}

export function OnboardingWelcomeDialog({
  open,
  busy,
  progress,
  actionHref,
  onClose,
  onStart,
  returnFocusRef,
}: OnboardingWelcomeDialogProps) {
  const { t } = useI18n()
  const resolvedActionHref = actionHref ?? progress.actionHref
  const steps: ReadonlyArray<{ id: OnboardingStep; label: string }> = [
    { id: 'space', label: t('onboarding.stepDetails.space.label') },
    { id: 'box', label: t('onboarding.stepDetails.box.label') },
    { id: 'item', label: t('onboarding.stepDetails.item.label') },
  ]
  const copy = {
    title: t(`onboarding.stepDetails.${progress.currentStep}.title`),
    description: t(`onboarding.stepDetails.${progress.currentStep}.description`),
    action: t(`onboarding.stepDetails.${progress.currentStep}.action`),
  }

  return (
    <ResponsiveEditorDialog
      open={open}
      title={t('onboarding.title')}
      busy={busy}
      dismissible={false}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      maxWidthClassName="max-w-xl"
      initialFocusSelector="button[data-onboarding-primary]:not(:disabled)"
    >
      <div className="grid gap-6">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="m-0 text-meta font-bold tracking-eyebrow text-brand-strong">{t('onboarding.taskLabel')}</p>
            <span className="shrink-0 rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand-strong">
              {t('onboarding.progress', { completed: progress.completedCount, total: 3 })}
            </span>
          </div>
          <h3 className="m-0 text-section-title font-extrabold text-ink">{copy.title}</h3>
          <p className="mt-2 max-w-xl text-body leading-relaxed text-muted">{copy.description}</p>
        </div>

        <ol className="grid gap-3" aria-label={t('onboarding.progressLabel')}>
          {steps.map((step, index) => {
            const completed = index < progress.completedCount
            const current = step.id === progress.currentStep
            return (
              <li
                className={`flex items-center gap-3 ${completed || current ? 'text-ink' : 'text-muted'}`}
                key={step.id}
                aria-current={current ? 'step' : undefined}
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-extrabold ${completed ? 'bg-brand text-white' : current ? 'border-2 border-brand bg-brand/10 text-brand-strong' : 'border border-line bg-canvas text-muted'}`}
                  aria-hidden="true"
                >
                  {completed ? '✓' : index + 1}
                </span>
                <span className={current ? 'font-bold' : 'font-medium'}>{step.label}</span>
              </li>
            )
          })}
        </ol>

        <button
          className="inline-flex min-h-12 w-full items-center justify-center rounded-control bg-brand px-5 py-3 font-bold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          type="button"
          data-onboarding-primary
          disabled={busy}
          onClick={() => {
            onClose()
            onStart(resolvedActionHref)
          }}
        >
          {copy.action}
        </button>
      </div>
    </ResponsiveEditorDialog>
  )
}
