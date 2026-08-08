export type OnboardingStep = 'space' | 'box' | 'item'

export type OnboardingProgressInput = {
  hasSpace: boolean
  hasBox: boolean
  hasItem: boolean
  firstBoxPublicId?: string
}

export type OnboardingProgress = {
  currentStep: OnboardingStep
  completedCount: number
  isComplete: boolean
  actionHref: string
}

export function getOnboardingProgress(input: OnboardingProgressInput): OnboardingProgress {
  const completedCount = Number(input.hasSpace) + Number(input.hasBox) + Number(input.hasItem)
  const currentStep: OnboardingStep = !input.hasSpace ? 'space' : !input.hasBox ? 'box' : 'item'
  const actionHref = currentStep === 'space'
    ? '/app/spaces?create=1'
    : currentStep === 'box'
      ? '/app/boxes?create=1'
      : input.firstBoxPublicId
        ? `/b/${input.firstBoxPublicId}`
        : '/app/boxes'

  return {
    currentStep,
    completedCount,
    isComplete: input.hasItem,
    actionHref,
  }
}
