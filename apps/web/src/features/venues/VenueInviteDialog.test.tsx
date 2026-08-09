import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { MobileFeedbackProvider } from '../../components/MobileFeedbackProvider'
import { VenueInviteDialog } from './VenueInviteDialog'

const mocks = vi.hoisted(() => ({ qr: vi.fn(), revoke: vi.fn(), copy: vi.fn(), share: vi.fn() }))
vi.mock('qrcode', () => ({ default: { toDataURL: mocks.qr } }))
vi.mock('./venue-sharing.api', () => ({ revokeVenueInvite: mocks.revoke }))
vi.mock('../../lib/env', () => ({ publicAppOrigin: () => 'https://nomo.example/' }))

function renderDialog(overrides: Partial<Parameters<typeof VenueInviteDialog>[0]> = {}) {
  const props: Parameters<typeof VenueInviteDialog>[0] = { open: true, invite: { invite_id: 'invite-1', token: 'raw-token', expires_at: '2026-08-10T00:00:00Z' }, onClose: vi.fn(), ...overrides }
  render(<I18nProvider><MobileFeedbackProvider><button type="button">触发器</button><VenueInviteDialog {...props} /></MobileFeedbackProvider></I18nProvider>)
  return props
}

beforeEach(() => {
  mocks.qr.mockReset(); mocks.revoke.mockReset(); mocks.copy.mockReset(); mocks.share.mockReset()
  mocks.qr.mockResolvedValue('data:image/png;base64,qr')
  mocks.copy.mockResolvedValue(undefined)
  mocks.share.mockResolvedValue(undefined)
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: mocks.copy } })
  Object.defineProperty(window.navigator, 'share', { configurable: true, value: mocks.share })
})
afterEach(cleanup)

test('renders a QR code and communicates the single-use 24-hour limit', async () => {
  renderDialog()
  expect(await screen.findByRole('img', { name: '场地邀请二维码' })).toHaveAttribute('src', 'data:image/png;base64,qr')
  expect(screen.getByText('邀请链接将在 24 小时后失效，且只能使用一次。')).toBeInTheDocument()
  expect(mocks.qr).toHaveBeenCalledWith('https://nomo.example/join/venue#token=raw-token', expect.objectContaining({ errorCorrectionLevel: 'M', margin: 2, width: 1024 }))
})

test('copies on demand and reports the copied state', async () => {
  const user = userEvent.setup()
  renderDialog()
  await user.click(screen.getByRole('button', { name: '复制邀请链接' }))
  expect(await screen.findByRole('button', { name: '已复制邀请链接' })).toBeInTheDocument()
})

test('uses a clear primary-first action stack and separates the destructive revoke action', async () => {
  renderDialog()

  const actions = screen.getByTestId('venue-invite-actions')
  expect(actions).toHaveClass('grid', 'gap-3')
  expect(within(actions).getAllByRole('button').map((button) => button.textContent)).toEqual(['分享邀请链接', '复制邀请链接'])
  expect(screen.getByTestId('venue-invite-danger-zone')).toHaveClass('border-t')
  expect(screen.getByTestId('venue-invite-danger-zone')).toContainElement(screen.getByRole('button', { name: '撤销邀请' }))
})

test('disables actions while revoking and closes only after an owner revokes the invite', async () => {
  const user = userEvent.setup()
  let resolve: (() => void) | undefined
  mocks.revoke.mockReturnValue(new Promise<void>((done) => { resolve = done }))
  const props = renderDialog()
  await user.click(screen.getByRole('button', { name: '撤销邀请' }))
  expect(screen.getByRole('button', { name: '撤销中…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '复制邀请链接' })).toBeDisabled()
  resolve?.()
  await waitFor(() => expect(props.onClose).toHaveBeenCalled())
  expect(mocks.revoke).toHaveBeenCalledWith('invite-1')
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

test('keeps user-cancelled share sheets quiet', async () => {
  const user = userEvent.setup()
  mocks.share.mockRejectedValue(new DOMException('cancelled', 'AbortError'))
  renderDialog()

  await user.click(screen.getByRole('button', { name: '分享邀请链接' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})
