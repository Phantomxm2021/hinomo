import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { PrintPage } from './PrintPage'

const { mockListBoxes, mockRenderLabelsPdf } = vi.hoisted(() => ({
  mockListBoxes: vi.fn(),
  mockRenderLabelsPdf: vi.fn(),
}))
vi.mock('../boxes/boxes.api', () => ({ listBoxes: mockListBoxes }))
vi.mock('./pdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./pdf')>()
  return { ...actual, renderLabelsPdf: mockRenderLabelsPdf }
})

afterEach(cleanup)

test('requires a box selection before generating a PDF', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue([{
    id: 'box-1', public_id: 'public-1', box_code: 'BX-00001', name: '冬季衣物',
    space_name: '家', location: '衣柜上层', visibility: 'private',
  }])
  mockRenderLabelsPdf.mockResolvedValue(undefined)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><PrintPage /></QueryClientProvider>)

  const generate = screen.getByRole('button', { name: '生成 PDF' })
  expect(generate).toBeDisabled()
  await user.click(await screen.findByRole('checkbox', { name: /冬季衣物/ }))
  expect(generate).toBeEnabled()
  await user.click(generate)

  expect(mockRenderLabelsPdf).toHaveBeenCalledOnce()
})
