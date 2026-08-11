import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, type PropsWithChildren } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { OnboardingWelcomeDialog } from './OnboardingWelcomeDialog'
import { getOnboardingProgress } from './onboarding-progress'
import { I18nProvider, useI18n } from '../../i18n/I18nProvider'

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

test.each([
  [
    'space',
    { hasSpace: false, hasBox: false, hasItem: false },
    { currentStep: 'space', completedCount: 0, isComplete: false, actionHref: '/app/spaces?create=1' },
  ],
  [
    'box',
    { hasSpace: true, hasBox: false, hasItem: false },
    { currentStep: 'box', completedCount: 1, isComplete: false, actionHref: '/app/boxes?create=1' },
  ],
  [
    'item',
    { hasSpace: true, hasBox: true, hasItem: false, firstBoxPublicId: 'box-1' },
    { currentStep: 'item', completedCount: 2, isComplete: false, actionHref: '/b/box-1' },
  ],
  [
    'complete',
    { hasSpace: true, hasBox: true, hasItem: true },
    { currentStep: 'item', completedCount: 3, isComplete: true, actionHref: '/app/boxes' },
  ],
] as const)('derives the %s onboarding progress state', (_name, input, expected) => {
  expect(getOnboardingProgress(input)).toEqual(expected)
})

test('falls back to the boxes page when the first box has no public id', () => {
  expect(getOnboardingProgress({ hasSpace: true, hasBox: true, hasItem: false }).actionHref).toBe('/app/boxes')
})

test('renders an accessible three-step dialog with the current action', () => {
  const progress = getOnboardingProgress({ hasSpace: true, hasBox: false, hasItem: false })

  render(<OnboardingWelcomeDialog open busy={false} progress={progress} onClose={vi.fn()} onStart={vi.fn()} />)

  const dialog = screen.getByRole('dialog', { name: '开始使用 Nomo' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog).toHaveClass('rounded-t-[1.5rem]', 'lg:rounded-shell')
  expect(screen.getByRole('list', { name: '新手任务进度' })).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(3)
  expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('创建第一个箱子')
  expect(screen.getByRole('button', { name: '创建第一个箱子' })).toBeInTheDocument()
})

test('focuses the primary action when it opens', async () => {
  const progress = getOnboardingProgress({ hasSpace: false, hasBox: false, hasItem: false })

  render(<OnboardingWelcomeDialog open busy={false} progress={progress} onClose={vi.fn()} onStart={vi.fn()} />)

  await waitFor(() => expect(screen.getByRole('button', { name: '创建第一个空间' })).toHaveFocus())
})

test('closes before starting the actionHref override', async () => {
  const user = userEvent.setup()
  const events: string[] = []
  const onClose = vi.fn(() => events.push('close'))
  const onStart = vi.fn(() => events.push('start'))
  const progress = getOnboardingProgress({ hasSpace: false, hasBox: false, hasItem: false })

  render(<OnboardingWelcomeDialog open busy={false} progress={progress} actionHref="/app/onboarding" onClose={onClose} onStart={onStart} />)

  await user.click(screen.getByRole('button', { name: '创建第一个空间' }))

  expect(onClose).toHaveBeenCalledTimes(1)
  expect(onStart).toHaveBeenCalledWith('/app/onboarding')
  expect(events).toEqual(['close', 'start'])
})

test('does not expose dismissal UI', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const progress = getOnboardingProgress({ hasSpace: false, hasBox: false, hasItem: false })

  render(<OnboardingWelcomeDialog open busy={false} progress={progress} onClose={onClose} onStart={vi.fn()} />)

  expect(screen.queryByRole('button', { name: '关闭开始使用 Nomo' })).not.toBeInTheDocument()
  await user.keyboard('{Escape}')
  fireEvent.mouseDown(screen.getByTestId('editor-dialog-backdrop'))

  expect(onClose).not.toHaveBeenCalled()
})

test('disables every action while busy', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const onStart = vi.fn()
  const progress = getOnboardingProgress({ hasSpace: false, hasBox: false, hasItem: false })

  render(<OnboardingWelcomeDialog open busy progress={progress} onClose={onClose} onStart={onStart} />)

  const cta = screen.getByRole('button', { name: '创建第一个空间' })
  expect(cta).toBeDisabled()
  await user.click(cta)
  expect(onClose).not.toHaveBeenCalled()
  expect(onStart).not.toHaveBeenCalled()
})

test('renders localized onboarding dialog copy in English', async () => {
  const progress = getOnboardingProgress({ hasSpace: false, hasBox: false, hasItem: false })
  function EnglishProvider({ children }: PropsWithChildren) {
    const { setLocale } = useI18n()
    useEffect(() => setLocale('en-US'), [setLocale])
    return <>{children}</>
  }

  render(
    <I18nProvider>
      <EnglishProvider><OnboardingWelcomeDialog open busy={false} progress={progress} onClose={vi.fn()} onStart={vi.fn()} /></EnglishProvider>
    </I18nProvider>,
  )

  const dialog = await screen.findByRole('dialog', { name: 'Get started with Nomo' })
  expect(dialog).toHaveTextContent('Create your first space')
  expect(dialog).toHaveTextContent('0/3 complete')
})
