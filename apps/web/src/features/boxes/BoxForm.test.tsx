import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { BoxForm } from './BoxForm'

const { mockCreateBox, mockGetBox, mockListSpaces, mockUpdateBox, mockUploadReset } = vi.hoisted(() => ({
  mockCreateBox: vi.fn(),
  mockGetBox: vi.fn(),
  mockListSpaces: vi.fn(),
  mockUpdateBox: vi.fn(),
  mockUploadReset: vi.fn(),
}))

vi.mock('./boxes.api', () => ({
  createBox: mockCreateBox,
  getBox: mockGetBox,
  updateBox: mockUpdateBox,
}))
vi.mock('../spaces/spaces.api', () => ({ listSpaces: mockListSpaces }))
vi.mock('../media/useMediaUpload', () => ({
  useMediaUpload: () => ({ stage: 'idle', upload: vi.fn(), reset: mockUploadReset }),
}))

function renderForm(onLimitReached = vi.fn(), boxId?: string, onVenueAccessDenied = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <BoxForm boxId={boxId} presentation="modal" onLimitReached={onLimitReached} onVenueAccessDenied={onVenueAccessDenied} />
      </QueryClientProvider>
    </MemoryRouter>,
  )
  return { onLimitReached, onVenueAccessDenied }
}

beforeEach(() => {
  mockCreateBox.mockReset()
  mockGetBox.mockReset()
  mockListSpaces.mockReset()
  mockUpdateBox.mockReset()
  mockUploadReset.mockReset()
  mockListSpaces.mockResolvedValue([
    { id: 'space-home', name: '家', description: null, box_count: 3 },
  ])
  mockGetBox.mockResolvedValue({
    id: 'box-1',
    public_id: 'public-1',
    box_code: 'BX-00001',
    space_id: 'space-home',
    name: '已有箱子',
    category: null,
    location: null,
    description: null,
    visibility: 'private',
  })
})

afterEach(cleanup)

test('preserves entered values and reports the authoritative box limit without a generic save error', async () => {
  const user = userEvent.setup()
  const { onLimitReached } = renderForm()
  mockCreateBox.mockRejectedValue({ message: 'box_limit_reached' })

  await user.selectOptions(await screen.findByLabelText('空间'), 'space-home')
  await user.type(screen.getByLabelText('箱子名称'), '需要保留的衣物')
  await user.type(screen.getByLabelText('具体位置'), '衣柜顶层')
  await user.click(screen.getByRole('button', { name: '创建箱子' }))

  await waitFor(() => expect(onLimitReached).toHaveBeenCalledTimes(1))
  expect(screen.queryByText('保存失败，请稍后重试')).not.toBeInTheDocument()
  expect(screen.getByLabelText('空间')).toHaveValue('space-home')
  expect(screen.getByLabelText('箱子名称')).toHaveValue('需要保留的衣物')
  expect(screen.getByLabelText('具体位置')).toHaveValue('衣柜顶层')
})

test('keeps ordinary create failures on the existing save-error path', async () => {
  const user = userEvent.setup()
  const { onLimitReached } = renderForm()
  mockCreateBox.mockRejectedValue(new Error('network unavailable'))

  await user.selectOptions(await screen.findByLabelText('空间'), 'space-home')
  await user.type(screen.getByLabelText('箱子名称'), '工具')
  await user.click(screen.getByRole('button', { name: '创建箱子' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('保存失败，请稍后重试')
  expect(onLimitReached).not.toHaveBeenCalled()
  expect(screen.getByLabelText('箱子名称')).toHaveValue('工具')
})

test('keeps edit failures on the save-error path even when their message resembles a create limit', async () => {
  const user = userEvent.setup()
  const onLimitReached = vi.fn()
  mockUpdateBox.mockRejectedValue({ message: 'box_limit_reached' })
  renderForm(onLimitReached, 'box-1')

  await screen.findByDisplayValue('已有箱子')
  await user.click(screen.getByRole('button', { name: '保存修改' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('保存失败，请稍后重试')
  expect(onLimitReached).not.toHaveBeenCalled()
})

test('forwards revoked access from a box create mutation to the page handler', async () => {
  const user = userEvent.setup()
  const onVenueAccessDenied = vi.fn()
  renderForm(vi.fn(), undefined, onVenueAccessDenied)
  mockCreateBox.mockRejectedValue({ code: 'venue_access_denied' })

  await user.selectOptions(await screen.findByLabelText('空间'), 'space-home')
  await user.type(screen.getByLabelText('箱子名称'), '共享工具')
  await user.click(screen.getByRole('button', { name: '创建箱子' }))

  await waitFor(() => expect(onVenueAccessDenied).toHaveBeenCalledWith({ code: 'venue_access_denied' }))
})
