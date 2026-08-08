import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { BoxLimitPaywall } from './BoxLimitPaywall'

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
  document.querySelectorAll('[data-overlay-layer="action-sheet"]').forEach((overlay) => overlay.remove())
})

test('does not render a dialog while closed', () => {
  render(<BoxLimitPaywall open={false} busy={false} onClose={vi.fn()} onPurchase={vi.fn()} />)

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('renders the lifetime unlock offer as a modal dialog', () => {
  render(<BoxLimitPaywall open busy={false} onClose={vi.fn()} onPurchase={vi.fn()} />)

  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog).toHaveTextContent('免费版最多可保有 3 个箱子')
  expect(dialog).toHaveTextContent('HK$38 永久解锁')
  expect(dialog).toHaveTextContent('暂不需要')
  expect(dialog).toHaveTextContent('一次性付款，不订阅、不自动续费')
  expect(dialog).toHaveTextContent('AI 图片识别 Credits 需单独购买')
  expect(dialog.parentElement).toHaveAttribute('data-overlay-layer', 'box-limit-paywall')
})

test('starts one checkout when purchase is selected', async () => {
  const user = userEvent.setup()
  const onPurchase = vi.fn()
  render(<BoxLimitPaywall open busy={false} onClose={vi.fn()} onPurchase={onPurchase} />)

  await user.click(screen.getByRole('button', { name: 'HK$38 永久解锁' }))

  expect(onPurchase).toHaveBeenCalledTimes(1)
})

test('offers a visible not-now dismissal action', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(<BoxLimitPaywall open busy={false} onClose={onClose} onPurchase={vi.fn()} />)

  await user.click(screen.getByRole('button', { name: '暂不需要' }))

  expect(onClose).toHaveBeenCalledTimes(1)
})

test('blocks every dismissal path while checkout is busy', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(<BoxLimitPaywall open busy onClose={onClose} onPurchase={vi.fn()} />)

  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByRole('button', { name: '购买中…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '关闭箱子额度提示' })).toBeDisabled()
  await waitFor(() => expect(dialog).toHaveFocus())
  await user.tab()
  expect(dialog).toHaveFocus()
  await user.tab({ shift: true })
  expect(dialog).toHaveFocus()

  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: '关闭箱子额度提示' }))
  fireEvent.mouseDown(screen.getByTestId('box-limit-paywall-backdrop'))

  expect(onClose).not.toHaveBeenCalled()
})

test('does not consume Escape when a later equal-layer overlay is visually on top', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(<BoxLimitPaywall open busy={false} onClose={onClose} onPurchase={vi.fn()} />)
  const laterOverlay = document.createElement('div')
  laterOverlay.setAttribute('data-overlay-layer', 'action-sheet')
  laterOverlay.style.zIndex = '2147483645'
  document.body.append(laterOverlay)

  await user.keyboard('{Escape}')

  expect(onClose).not.toHaveBeenCalled()
  laterOverlay.remove()
})

test('closes from Escape or the backdrop and restores focus to the opener', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const opener = document.createElement('button')
  opener.textContent = '提交'
  document.body.append(opener)
  opener.focus()
  const view = render(<BoxLimitPaywall open busy={false} onClose={onClose} onPurchase={vi.fn()} />)

  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledTimes(1)

  view.rerender(<BoxLimitPaywall open={false} busy={false} onClose={onClose} onPurchase={vi.fn()} />)
  await waitFor(() => expect(opener).toHaveFocus())

  view.rerender(<BoxLimitPaywall open busy={false} onClose={onClose} onPurchase={vi.fn()} />)
  fireEvent.mouseDown(screen.getByTestId('box-limit-paywall-backdrop'))
  expect(onClose).toHaveBeenCalledTimes(2)
  opener.remove()
})
