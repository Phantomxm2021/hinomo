import { Link } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'

type OnboardingStep = 'space' | 'box' | 'item'

const steps = [
  { id: 'space', label: '创建一个空间' },
  { id: 'box', label: '创建第一个箱子' },
  { id: 'item', label: '记录箱内物品' },
] as const

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

export function OnboardingProgressCard({
  hasSpace,
  hasBox,
  hasItem,
  firstBoxPublicId,
}: {
  hasSpace: boolean
  hasBox: boolean
  hasItem: boolean
  firstBoxPublicId?: string
}) {
  if (hasItem) return null

  const currentStep: OnboardingStep = !hasSpace ? 'space' : !hasBox ? 'box' : 'item'
  const completedCount = Number(hasSpace) + Number(hasBox) + Number(hasItem)
  const copy = stepCopy[currentStep]
  const actionHref = currentStep === 'space'
    ? '/app/spaces?create=1'
    : currentStep === 'box'
      ? '/app/boxes?create=1'
      : firstBoxPublicId ? `/b/${firstBoxPublicId}` : '/app/boxes'

  return (
    <section className="overflow-hidden rounded-shell border border-brand/20 bg-surface shadow-soft" aria-labelledby="onboarding-title">
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.72fr)] lg:items-center lg:gap-8 lg:p-8">
        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="m-0 text-meta font-bold tracking-eyebrow text-brand-strong">
              <span className="lg:hidden">下一步</span>
              <span className="hidden lg:inline">开始使用 Nomo</span>
            </p>
            <span className="shrink-0 rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand-strong">{completedCount}/3</span>
          </div>
          <h2 className="m-0 text-section-title font-extrabold text-ink" id="onboarding-title">{copy.title}</h2>
          <p className="mt-2 max-w-xl text-body leading-relaxed text-muted">{copy.description}</p>
          <Link className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-brand px-5 py-3 font-bold text-white no-underline hover:bg-brand-strong sm:w-auto" to={actionHref}>
            {copy.action}<AppIcon name="chevron-right" size={18} />
          </Link>
        </div>

        <ol className="hidden gap-3 border-l border-line pl-6 lg:grid" aria-label="新手任务进度">
          {steps.map((step, index) => {
            const completed = index < completedCount
            const current = step.id === currentStep
            return (
              <li className={`flex items-center gap-3 ${completed || current ? 'text-ink' : 'text-muted'}`} key={step.id} aria-current={current ? 'step' : undefined}>
                <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-extrabold ${completed ? 'bg-brand text-white' : current ? 'border-2 border-brand bg-brand/10 text-brand-strong' : 'border border-line bg-canvas text-muted'}`} aria-hidden="true">
                  {completed ? '✓' : index + 1}
                </span>
                <span className={current ? 'font-bold' : 'font-medium'}>{step.label}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
