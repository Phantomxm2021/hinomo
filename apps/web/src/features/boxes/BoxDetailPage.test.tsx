import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { BoxDetailPage } from './BoxDetailPage'

const { mockGetBox } = vi.hoisted(() => ({ mockGetBox: vi.fn() }))
vi.mock('./boxes.api', () => ({ getBox: mockGetBox }))

afterEach(cleanup)

test('shows a structured skeleton while the box is loading', () => {
  mockGetBox.mockReturnValue(new Promise(() => undefined))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(
    <MemoryRouter initialEntries={['/app/boxes/box-1']}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/app/boxes/:boxId" element={<BoxDetailPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  )

  expect(screen.getByRole('status', { name: '正在加载箱子详情' })).toBeInTheDocument()
  expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(1)
  expect(screen.queryByText('正在加载箱子…')).not.toBeInTheDocument()
})
