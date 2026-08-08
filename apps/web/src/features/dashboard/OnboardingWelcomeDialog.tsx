import { type RefObject } from 'react'
import { ResponsiveEditorDialog } from '../../components/ResponsiveEditorDialog'
import type { OnboardingProgress, OnboardingStep } from './onboarding-progress'

export type OnboardingWelcomeDialogProps = {
  open: boolean
  busy: boolean
  progress: OnboardingProgress
  onClose: () => void
  onStart: (actionHref: string) => void
  returnFocusRef?: RefObject<HTMLElement | null>
}

const steps: ReadonlyArray<{ id: OnboardingStep; label: string }> = [
  { id: 'space', label: '创建一个空间' },
  { id: 'box', label: '创建第一个箱子' },
  { id: 'item', label: '记录箱内物品' },
]

const stepCopy: Record<OnboardingStep, { title: string; description: string; action: string }> = {
  space: {
    title: '从一个空间开始',
    description: '空间可以是客厅、卧室、储藏室，也可以是一组货架。',
    action: '创建第一个空间',
  },
  box: {
    title: '创建第一个箱子',
    description: '记录它放在哪里、里面有什么，以后就不用再翻找。',
    action: '创建第一个箱子',
  },
  item: {
    title: '记录箱内物品',
    description: '打开刚创建的箱子，拍照识别或手动添加物品。',
    action: '记录箱内物品',
  },
}

export function OnboardingWelcomeDialog({
  open,
  busy,
  progress,
  onClose,
  onStart,
  returnFocusRef,
}: OnboardingWelcomeDialogProps) {
  const copy = stepCopy[progress.currentStep]

  return (
    <ResponsiveEditorDialog
      open={open}
      title="开始使用 Nomo"
      busy={busy}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      maxWidthClassName="max-w-xl"
      initialFocusSelector="button[data-onboarding-primary]:not(:disabled)"
    >
      <div className="grid gap-6">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="m-0 text-meta font-bold tracking-eyebrow text-brand-strong">新手任务</p>
            <span className="shrink-0 rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand-strong">
              {progress.completedCount}/3
            </span>
          </div>
          <h3 className="m-0 text-section-title font-extrabold text-ink">{copy.title}</h3>
          <p className="mt-2 max-w-xl text-body leading-relaxed text-muted">{copy.description}</p>
        </div>

        <ol className="grid gap-3" aria-label="新手任务进度">
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
            onStart(progress.actionHref)
          }}
        >
          {copy.action}
        </button>
      </div>
    </ResponsiveEditorDialog>
  )
}
