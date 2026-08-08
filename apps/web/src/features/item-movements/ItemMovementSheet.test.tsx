import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, type PropsWithChildren } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { I18nProvider, useI18n } from '../../i18n/I18nProvider'
import { ItemMovementSheet } from './ItemMovementSheet'

afterEach(cleanup)

const item = {
  id: 'item-1',
  name: '露营灯',
  category: null,
  quantity: 3,
  stored_quantity: 2,
  description: null,
}

const targetBox = {
  id: 'box-2',
  public_id: 'public-2',
  box_code: 'BX-2',
  name: '露营箱',
  space_id: 'space-2',
  location: null,
  visibility: 'private' as const,
  space_name: '储物间',
  venue_name: '家里',
  cover_object_key: null,
  item_count: 0,
  updated_at: '2026-08-02T00:00:00Z',
}

function EnglishProvider({ children }: PropsWithChildren) {
  const { setLocale } = useI18n()
  useEffect(() => setLocale('en-US'), [setLocale])
  return <>{children}</>
}

test('takes out a quantity with optional handler context', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(<ItemMovementSheet open item={item} currentBoxId="box-1" boxes={[targetBox]} pending={false} onClose={vi.fn()} onEdit={vi.fn()} onSubmit={onSubmit} />)

  expect(screen.getByText('部分取出 · 2/3 在箱中')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /^取出/ }))
  await user.type(screen.getByLabelText('经手人或用途（可选）'), '小林')
  await user.click(screen.getByRole('button', { name: '确认取出' }))

  expect(onSubmit).toHaveBeenCalledWith({ action: 'take_out', quantity: 1, handlerLabel: '小林', note: null })
})

test('only allows moving a fully stored item and identifies the destination path', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const { rerender } = render(<ItemMovementSheet open item={item} currentBoxId="box-1" boxes={[targetBox]} pending={false} onClose={vi.fn()} onEdit={vi.fn()} onSubmit={onSubmit} />)

  expect(screen.getByRole('button', { name: '移动到其他箱子' })).toBeDisabled()
  rerender(<ItemMovementSheet open item={{ ...item, stored_quantity: 3 }} currentBoxId="box-1" boxes={[targetBox]} pending={false} onClose={vi.fn()} onEdit={vi.fn()} onSubmit={onSubmit} />)
  await user.click(screen.getByRole('button', { name: '移动到其他箱子' }))
  await user.selectOptions(screen.getByLabelText('目标箱子'), 'box-2')
  await user.click(screen.getByRole('button', { name: '确认移动' }))

  expect(screen.getByRole('option', { name: '家里 · 储物间 · 露营箱' })).toBeInTheDocument()
  expect(onSubmit).toHaveBeenCalledWith({ action: 'move', targetBoxId: 'box-2', note: null })
})

test('offers return only for the quantity currently out', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(<ItemMovementSheet open item={item} currentBoxId="box-1" boxes={[]} pending={false} onClose={vi.fn()} onEdit={vi.fn()} onSubmit={onSubmit} />)

  expect(screen.getByRole('button', { name: /^放回/ })).toHaveTextContent('待归还 1 件')
  await user.click(screen.getByRole('button', { name: /^放回/ }))
  expect(screen.getByLabelText('数量')).toHaveAttribute('max', '1')
  await user.click(screen.getByRole('button', { name: '确认放回' }))
  expect(onSubmit).toHaveBeenCalledWith({ action: 'return', quantity: 1, note: null })
})

test('opens the private movement history without exposing it in the item row', async () => {
  const user = userEvent.setup()
  render(
    <ItemMovementSheet
      open
      item={item}
      currentBoxId="box-1"
      boxes={[]}
      movements={[{
        id: 'movement-1', item_id: 'item-1', actor_id: 'user-1', action: 'take_out', quantity: 1,
        from_box_id: 'box-1', to_box_id: null, from_box: { name: '工具箱' }, to_box: null,
        handler_label: '露营', note: null, created_at: '2026-08-02T08:30:00Z',
      }]}
      pending={false}
      onClose={vi.fn()}
      onEdit={vi.fn()}
      onSubmit={vi.fn()}
    />,
  )

  await user.click(screen.getByRole('button', { name: '查看流转记录' }))
  expect(screen.getByRole('dialog', { name: '流转记录' })).toHaveTextContent('从 工具箱 取出')
  expect(screen.getByText('取出 1 件')).toBeInTheDocument()
})

test('localizes item movement actions and availability in English', async () => {
  const user = userEvent.setup()
  render(
    <I18nProvider>
      <EnglishProvider>
        <ItemMovementSheet open item={item} currentBoxId="box-1" boxes={[targetBox]} pending={false} onClose={vi.fn()} onEdit={vi.fn()} onSubmit={vi.fn().mockResolvedValue(undefined)} />
      </EnglishProvider>
    </I18nProvider>,
  )

  expect(screen.getByText('Partially out · 2/3 stored')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /^Take out/ }))
  expect(screen.getByLabelText('Handler or purpose (optional)')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Confirm take out' })).toBeInTheDocument()
})
