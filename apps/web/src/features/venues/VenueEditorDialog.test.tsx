import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { VenueEditorDialog } from './VenueEditorDialog'

afterEach(cleanup)

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
  render(<VenueEditorDialog {...props} />)
  return props
}

test('validates an empty venue name before calling the API', async () => {
  const user = userEvent.setup()
  const props = renderEditor()

  await user.click(screen.getByRole('button', { name: '创建场地' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('请输入场地名称')
  expect(props.onSubmit).not.toHaveBeenCalled()
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
    venue: { id: 'home', name: '家里', description: null, space_count: 2 },
  })

  expect(screen.getByText('该场地包含 2 个空间，移走空间后才能删除。')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '删除场地' })).toBeDisabled()
  expect(props.onDelete).not.toHaveBeenCalled()
})

test('allows an empty venue to be deleted', async () => {
  const user = userEvent.setup()
  const props = renderEditor({
    venue: { id: 'office', name: '公司', description: null, space_count: 0 },
  })

  const dialog = screen.getByRole('dialog', { name: '编辑场地' })
  await user.click(within(dialog).getByRole('button', { name: '删除场地' }))

  expect(props.onDelete).toHaveBeenCalledWith({
    id: 'office', name: '公司', description: null, space_count: 0,
  })
})
