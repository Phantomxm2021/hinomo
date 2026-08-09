import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider, useI18n } from '../../i18n/I18nProvider'
import { MobileFeedbackProvider } from '../../components/MobileFeedbackProvider'
import { VenueInviteDialog } from './VenueInviteDialog'

const mocks = vi.hoisted(() => ({ qr: vi.fn(), copy: vi.fn(), share: vi.fn() }))
vi.mock('qrcode', () => ({ default: { toDataURL: mocks.qr } }))
vi.mock('../../lib/env', () => ({ publicAppOrigin: () => 'https://nomo.example/' }))

function LocaleSetup({ locale }: { locale: 'zh-CN' | 'en-US' }) {
  const { setLocale } = useI18n()
  useEffect(() => setLocale(locale), [locale, setLocale])
  return null
}

function renderDialog(overrides: Partial<Parameters<typeof VenueInviteDialog>[0]> = {}, locale: 'zh-CN' | 'en-US' = 'zh-CN') {
  const props: Parameters<typeof VenueInviteDialog>[0] = { open: true, invite: { invite_id: 'invite-1', token: 'raw-token', expires_at: '2026-08-10T00:00:00Z', reusable: true }, onClose: vi.fn(), ...overrides }
  render(<I18nProvider><LocaleSetup locale={locale} /><MobileFeedbackProvider><button type="button">触发器</button><VenueInviteDialog {...props} /></MobileFeedbackProvider></I18nProvider>)
  return props
}

beforeEach(() => {
  mocks.qr.mockReset(); mocks.copy.mockReset(); mocks.share.mockReset()
  mocks.qr.mockResolvedValue('data:image/png;base64,qr')
  mocks.copy.mockResolvedValue(undefined)
  mocks.share.mockResolvedValue(undefined)
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: mocks.copy } })
  Object.defineProperty(window.navigator, 'share', { configurable: true, value: mocks.share })
})
afterEach(() => {
  cleanup()
})

test('renders a QR code and communicates that a reusable invitation can invite multiple family members', async () => {
  renderDialog({ invite: { invite_id: 'invite-1', token: 'raw-token', expires_at: '2026-08-10T00:00:00Z', reusable: true } })
  expect(await screen.findByRole('img', { name: '场地邀请二维码' })).toHaveAttribute('src', 'data:image/png;base64,qr')
  expect(screen.getByText(/同一个二维码可邀请多位家庭成员/)).toBeInTheDocument()
  expect(mocks.qr).toHaveBeenCalledWith('https://nomo.example/join/venue#token=raw-token', expect.objectContaining({ errorCorrectionLevel: 'M', margin: 2, width: 1024 }))
})

test('copies the newest reusable invitation token after the owner replaces an invitation', async () => {
  const user = userEvent.setup()
  const { rerender } = render(<I18nProvider><MobileFeedbackProvider><VenueInviteDialog open invite={{ invite_id: 'invite-1', token: 'first-token', expires_at: '2026-08-10T00:00:00Z', reusable: true }} onClose={vi.fn()} /></MobileFeedbackProvider></I18nProvider>)
  await screen.findByRole('img', { name: '场地邀请二维码' })
  rerender(<I18nProvider><MobileFeedbackProvider><VenueInviteDialog open invite={{ invite_id: 'invite-2', token: 'latest-token', expires_at: '2026-08-10T01:00:00Z', reusable: true }} onClose={vi.fn()} /></MobileFeedbackProvider></I18nProvider>)
  await waitFor(() => expect(mocks.qr).toHaveBeenLastCalledWith('https://nomo.example/join/venue#token=latest-token', expect.any(Object)))

  const latestCopy = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: latestCopy } })
  await user.click(screen.getByRole('button', { name: '复制邀请链接' }))
  expect(latestCopy).toHaveBeenCalledWith('https://nomo.example/join/venue#token=latest-token')
  expect(await screen.findByRole('button', { name: '已复制邀请链接' })).toBeInTheDocument()
})

test('copies on demand and reports the copied state', async () => {
  const user = userEvent.setup()
  renderDialog()
  await user.click(screen.getByRole('button', { name: '复制邀请链接' }))
  expect(await screen.findByRole('button', { name: '已复制邀请链接' })).toBeInTheDocument()
})

test('keeps the invite action stack free of visible revoke controls in Chinese', async () => {
  renderDialog()

  const actions = screen.getByTestId('venue-invite-actions')
  expect(actions).toHaveClass('grid', 'gap-3')
  expect(within(actions).getAllByRole('button').map((button) => button.textContent)).toEqual(['分享邀请链接', '复制邀请链接'])
  expect(screen.queryByRole('button', { name: '撤销邀请' })).not.toBeInTheDocument()
  expect(screen.queryByTestId('venue-invite-danger-zone')).not.toBeInTheDocument()
})

test('keeps the invite dialog free of visible revoke controls in English', async () => {
  renderDialog({}, 'en-US')

  expect(await screen.findByText('Share venue invitation')).toBeInTheDocument()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Revoke invitation' })).not.toBeInTheDocument()
  expect(screen.queryByTestId('venue-invite-danger-zone')).not.toBeInTheDocument()
})

test('offers retry for transient copy failures and retries the exact clipboard operation', async () => {
  const user = userEvent.setup()
  const copy = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(undefined)
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: copy } })
  renderDialog()

  await user.click(screen.getByRole('button', { name: '复制邀请链接' }))
  const alert = await screen.findByRole('alertdialog', { name: '操作未完成' })
  await user.click(within(alert).getByRole('button', { name: '重试' }))
  await waitFor(() => expect(copy).toHaveBeenCalledTimes(2))
})

test('offers retry for transient share failures and retries the exact share operation', async () => {
  const user = userEvent.setup()
  const share = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(undefined)
  Object.defineProperty(window.navigator, 'share', { configurable: true, value: share })
  renderDialog()

  await user.click(screen.getByRole('button', { name: '分享邀请链接' }))
  const alert = await screen.findByRole('alertdialog', { name: '操作未完成' })
  await user.click(within(alert).getByRole('button', { name: '重试' }))
  await waitFor(() => expect(share).toHaveBeenCalledTimes(2))
})

test('offers retry for transient QR failures and retries QR generation', async () => {
  const user = userEvent.setup()
  mocks.qr.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce('data:image/png;base64,retry-qr')
  renderDialog()

  const alert = await screen.findByRole('alertdialog', { name: '操作未完成' })
  await user.click(within(alert).getByRole('button', { name: '重试' }))
  await waitFor(() => expect(mocks.qr).toHaveBeenCalledTimes(2))
  expect(await screen.findByRole('img', { name: '场地邀请二维码' })).toHaveAttribute('src', 'data:image/png;base64,retry-qr')
})

test('supports Escape, contains focus, restores focus, and uses the mobile safe-area padding', async () => {
  const user = userEvent.setup()
  const props = renderDialog()
  const dialog = screen.getByRole('dialog', { name: '分享场地邀请' })
  expect(dialog).toHaveClass('pb-[max(1.25rem,var(--safe-area-bottom))]')
  await user.tab()
  expect(dialog).toContainElement(document.activeElement as HTMLElement)
  await user.keyboard('{Escape}')
  expect(props.onClose).toHaveBeenCalled()
})

test('opens the shared Apple alert when sharing fails for a reason other than cancellation', async () => {
  const user = userEvent.setup()
  mocks.share.mockRejectedValue(new TypeError('Failed to fetch'))
  renderDialog()

  await user.click(screen.getByRole('button', { name: '分享邀请链接' }))
  expect(await screen.findByRole('alertdialog', { name: '操作未完成' })).toHaveTextContent('网络连接出现问题')
})

test('opens the shared Apple alert when clipboard access fails', async () => {
  const user = userEvent.setup()
  const clipboardFailure = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: clipboardFailure } })
  renderDialog()

  await user.click(screen.getByRole('button', { name: '复制邀请链接' }))
  expect(await screen.findByRole('alertdialog', { name: '操作未完成' })).toHaveTextContent('网络连接出现问题')
})

test('keeps user-cancelled share sheets quiet', async () => {
  const user = userEvent.setup()
  mocks.share.mockRejectedValue(new DOMException('cancelled', 'AbortError'))
  renderDialog()

  await user.click(screen.getByRole('button', { name: '分享邀请链接' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('serializes share and copy so rapid clicks cannot duplicate invite actions', async () => {
  const user = userEvent.setup()
  let resolveShare!: () => void
  mocks.share.mockReturnValue(new Promise<void>((resolve) => { resolveShare = resolve }))
  renderDialog()

  const share = screen.getByRole('button', { name: '分享邀请链接' })
  const copy = screen.getByRole('button', { name: '复制邀请链接' })
  await user.click(share)
  expect(share).toBeDisabled()
  expect(copy).toBeDisabled()
  await user.click(share)
  await user.click(copy)
  expect(mocks.share).toHaveBeenCalledOnce()
  expect(mocks.copy).not.toHaveBeenCalled()

  resolveShare()
  await waitFor(() => expect(share).not.toBeDisabled())
})

test('disables sharing while a clipboard operation is pending', async () => {
  const user = userEvent.setup()
  let resolveCopy!: () => void
  const pendingCopy = vi.fn().mockReturnValue(new Promise<void>((resolve) => { resolveCopy = resolve }))
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: pendingCopy } })
  renderDialog()

  const copy = screen.getByRole('button', { name: '复制邀请链接' })
  const share = screen.getByRole('button', { name: '分享邀请链接' })
  await user.click(copy)
  expect(copy).toBeDisabled()
  expect(share).toBeDisabled()
  resolveCopy()
  await waitFor(() => expect(share).not.toBeDisabled())
})
