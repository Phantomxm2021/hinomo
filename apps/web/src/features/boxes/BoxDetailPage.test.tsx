import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { BoxDetailPage } from './BoxDetailPage'

const { mockGetBox } = vi.hoisted(() => ({ mockGetBox: vi.fn() }))
vi.mock('./boxes.api', () => ({ getBox: mockGetBox }))

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
          <Route path="/app/boxes/:boxId" element={<BoxDetailPage />} />
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

test('navigates with a cached public id when its refetch fails', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['box-id', 'box-1'], { public_id: 'public-cached' })
  mockGetBox.mockRejectedValue(new Error('network'))
  renderBoxDetail(client)

  expect(await screen.findByTestId('location')).toHaveTextContent('/b/public-cached')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
