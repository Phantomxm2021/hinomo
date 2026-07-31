import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { BoxDetailPage } from './BoxDetailPage'

const { mockGetBox } = vi.hoisted(() => ({ mockGetBox: vi.fn() }))
vi.mock('./boxes.api', () => ({ getBox: mockGetBox }))

beforeEach(() => {
  mockGetBox.mockReset()
})
afterEach(cleanup)

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function renderBoxDetail(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(
    <MemoryRouter initialEntries={['/app/boxes/box-1']}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/app/boxes/:boxId" element={<><BoxDetailPage /><LocationProbe /></>} />
          <Route path="/b/:publicId" element={<LocationProbe />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

test('shows a structured skeleton while the box is loading', () => {
  mockGetBox.mockReturnValue(new Promise(() => undefined))
  renderBoxDetail()

  expect(screen.getByRole('status', { name: '正在加载箱子详情' })).toBeInTheDocument()
  expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(1)
  expect(screen.queryByText('正在加载箱子…')).not.toBeInTheDocument()
})

test('shows a blocking error when box data is unavailable', async () => {
  mockGetBox.mockRejectedValue(new Error('network'))
  renderBoxDetail()

  expect(await screen.findByRole('alert')).toHaveTextContent('无权限或内容不存在')
})

test('offers retry and an explicit continue link when cached box data already has an error', async () => {
  const user = userEvent.setup()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['box-id', 'box-1'], {
    public_id: 'public-cached', name: '缓存工具箱', box_code: 'BX-CACHED',
  })
  await client.fetchQuery({
    queryKey: ['box-id', 'box-1'],
    queryFn: async () => { throw new Error('network') },
  }).catch(() => undefined)
  mockGetBox.mockRejectedValue(new Error('network'))
  renderBoxDetail(client)

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('缓存工具箱')
  expect(alert).toHaveTextContent('BX-CACHED')
  expect(screen.getByTestId('location')).toHaveTextContent('/app/boxes/box-1')
  await user.click(within(alert).getByRole('button', { name: '重试' }))
  await waitFor(() => expect(mockGetBox).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('缓存内容仍可使用'))
  await user.click(within(screen.getByRole('alert')).getByRole('link', { name: '继续打开箱子' }))
  expect(await screen.findByTestId('location')).toHaveTextContent('/b/public-cached')
})

test('immediately opens cached box data while its refetch remains unresolved', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['box-id', 'box-1'], {
    public_id: 'public-cached', name: '缓存工具箱', box_code: 'BX-CACHED',
  })
  mockGetBox.mockReturnValue(new Promise(() => undefined))
  renderBoxDetail(client)

  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/b/public-cached'))
  expect(screen.queryByRole('status', { name: '正在确认缓存箱子' })).not.toBeInTheDocument()
  expect(screen.queryByText('正在确认缓存箱子')).not.toBeInTheDocument()
})

test('automatically opens the public route after a successful box lookup', async () => {
  mockGetBox.mockResolvedValue({ public_id: 'public-success' })
  renderBoxDetail()

  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/b/public-success'))
})
