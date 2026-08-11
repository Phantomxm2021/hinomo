import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MobileFeedbackProvider } from '../../components/MobileFeedbackProvider'
import { BoxForm } from './BoxForm'

const { mockCreateBox, mockGetBox, mockListSpaces, mockUpdateBox, mockUpload, mockUploadReset } = vi.hoisted(() => ({
  mockCreateBox: vi.fn(),
  mockGetBox: vi.fn(),
  mockListSpaces: vi.fn(),
  mockUpdateBox: vi.fn(),
  mockUpload: vi.fn(),
  mockUploadReset: vi.fn(),
}))

vi.mock('./boxes.api', () => ({
  createBox: mockCreateBox,
  getBox: mockGetBox,
  updateBox: mockUpdateBox,
}))
vi.mock('../spaces/spaces.api', () => ({ listSpaces: mockListSpaces }))
vi.mock('../media/useMediaUpload', () => ({
  useMediaUpload: () => ({ stage: 'idle', upload: mockUpload, reset: mockUploadReset }),
}))

function renderForm(onLimitReached = vi.fn(), boxId?: string, onVenueAccessDenied = vi.fn(), onCompleted = vi.fn(), initialSpaceId?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <MemoryRouter>
      <MobileFeedbackProvider><QueryClientProvider client={client}>
        <BoxForm boxId={boxId} presentation="modal" onLimitReached={onLimitReached} onVenueAccessDenied={onVenueAccessDenied} onCompleted={onCompleted} initialSpaceId={initialSpaceId} />
      </QueryClientProvider></MobileFeedbackProvider>
    </MemoryRouter>,
  )
  return { onLimitReached, onVenueAccessDenied }
}

beforeEach(() => {
  mockCreateBox.mockReset()
  mockGetBox.mockReset()
  mockListSpaces.mockReset()
  mockUpdateBox.mockReset()
  mockUpload.mockReset()
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

test('prefills the space selected by onboarding after spaces load', async () => {
  mockListSpaces.mockResolvedValueOnce([
    { id: 'space-new', name: '新空间', description: null, box_count: 0 },
  ])
  renderForm(vi.fn(), undefined, vi.fn(), vi.fn(), 'space-new')

  expect(await screen.findByLabelText('空间')).toHaveValue('space-new')
})

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

  expect(await screen.findByRole('alertdialog', { name: '操作未完成' })).toHaveTextContent('暂时无法完成此操作')
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

  expect(await screen.findByRole('alertdialog', { name: '操作未完成' })).toHaveTextContent('暂时无法完成此操作')
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

test('completes a box without a cover without showing a cover recovery prompt', async () => {
  const user = userEvent.setup()
  const onCompleted = vi.fn()
  mockCreateBox.mockResolvedValue({ id: 'box-1', public_id: 'public-1', box_code: 'BX-00001', name: '无封面箱' })
  renderForm(vi.fn(), undefined, vi.fn(), onCompleted)

  await user.selectOptions(await screen.findByLabelText('空间'), 'space-home')
  await user.type(screen.getByLabelText('箱子名称'), '无封面箱')
  await user.click(screen.getByRole('button', { name: '创建箱子' }))

  await waitFor(() => expect(onCompleted).toHaveBeenCalledWith(expect.objectContaining({ id: 'box-1' })))
  expect(screen.queryByText('箱子记录已创建，但封面未完成。')).not.toBeInTheDocument()
})

test('continues with the created box when its optional cover upload fails', async () => {
  const user = userEvent.setup()
  const onCompleted = vi.fn()
  mockCreateBox.mockResolvedValue({ id: 'box-1', public_id: 'public-1', box_code: 'BX-00001', name: '无封面箱' })
  mockUpload.mockRejectedValueOnce(new Error('upload failed'))
  renderForm(vi.fn(), undefined, vi.fn(), onCompleted)

  await user.selectOptions(await screen.findByLabelText('空间'), 'space-home')
  await user.type(screen.getByLabelText('箱子名称'), '无封面箱')
  await user.upload(screen.getByLabelText('箱子封面（可选）'), new File(['cover'], 'cover.png', { type: 'image/png' }))
  await user.click(screen.getByRole('button', { name: '创建箱子' }))

  await waitFor(() => expect(onCompleted).toHaveBeenCalledWith(expect.objectContaining({ id: 'box-1' })))
  expect(screen.queryByRole('alertdialog', { name: '图片上传失败，已保留填写内容。' })).not.toBeInTheDocument()
})
