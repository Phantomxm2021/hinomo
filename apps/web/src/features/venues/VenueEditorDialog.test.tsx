import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { VenueEditorDialog } from './VenueEditorDialog'
import { I18nProvider } from '../../i18n/I18nProvider'
import { MobileFeedbackProvider } from '../../components/MobileFeedbackProvider'

afterEach(cleanup)

const venueAccess = { owner_id: 'owner-1', role: 'owner' as const, owner_display_name: null, member_count: 1, max_members: 5 }

function renderEditor(overrides: Partial<Parameters<typeof VenueEditorDialog>[0]> = {}) {
  const props: Parameters<typeof VenueEditorDialog>[0] = {
    open: true,
    venue: null,
    pending: false,
    error: false,
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  render(<I18nProvider><MobileFeedbackProvider><VenueEditorDialog {...props} /></MobileFeedbackProvider></I18nProvider>)
  return props
}

test('normalizes actual venue mutation errors through the shared Apple alert', async () => {
  renderEditor({ error: { code: 'venue_owner_required' } })
  expect(await screen.findByRole('alertdialog', { name: '操作未完成' })).toHaveTextContent('仅场地主人可以执行此操作')
})

test('validates an empty venue name before calling the API', async () => {
  const user = userEvent.setup()
  const props = renderEditor()

  await user.click(screen.getByRole('button', { name: '创建场地' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('请输入场地名称')
  expect(props.onSubmit).not.toHaveBeenCalled()
})

test('uses the close control instead of rendering a duplicate cancel button', () => {
  renderEditor()

  expect(screen.getByRole('button', { name: '关闭场地编辑器' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument()
})

test('normalizes a venue payload before submitting it', async () => {
  const user = userEvent.setup()
  const props = renderEditor()

  await user.type(screen.getByLabelText('场地名称'), '  公司  ')
  await user.type(screen.getByLabelText('描述（可选）'), '  二楼  ')
  await user.click(screen.getByRole('button', { name: '创建场地' }))

  expect(props.onSubmit).toHaveBeenCalledWith({ name: '公司', description: '二楼' })
})

test('prevents deletion while the venue still contains spaces', () => {
  const props = renderEditor({
    venue: { id: 'home', name: '家里', description: null, is_default: false, space_count: 2, ...venueAccess },
  })

  expect(screen.getByText('该场地包含 2 个空间，移走空间后才能删除。')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '删除场地' })).toBeDisabled()
  expect(props.onDelete).not.toHaveBeenCalled()
})

test('allows an empty venue to be deleted', async () => {
  const user = userEvent.setup()
  const props = renderEditor({
    venue: { id: 'office', name: '公司', description: null, is_default: false, space_count: 0, ...venueAccess },
  })

  const dialog = screen.getByRole('dialog', { name: '编辑场地' })
  await user.click(within(dialog).getByRole('button', { name: '删除场地' }))

  expect(props.onDelete).toHaveBeenCalledWith({
    id: 'office', name: '公司', description: null, is_default: false, space_count: 0, ...venueAccess,
  })
})

test('allows the built-in default venue to be renamed but not deleted', async () => {
  const user = userEvent.setup()
  const props = renderEditor({
    venue: { id: 'default', name: '默认', description: null, is_default: true, space_count: 0, ...venueAccess },
  })

  expect(screen.getByText('默认场地可以更名，但不能删除。')).toBeInTheDocument()
  await user.clear(screen.getByLabelText('场地名称'))
  await user.type(screen.getByLabelText('场地名称'), '我的家')
  await user.click(screen.getByRole('button', { name: '保存场地' }))

  expect(props.onSubmit).toHaveBeenCalledWith({ name: '我的家', description: null })
  expect(screen.getByRole('button', { name: '删除场地' })).toBeDisabled()
})
