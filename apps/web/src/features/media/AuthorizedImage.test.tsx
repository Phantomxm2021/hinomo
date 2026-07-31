import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { AuthorizedImage } from './AuthorizedImage'

const { mockCreateDownload } = vi.hoisted(() => ({ mockCreateDownload: vi.fn() }))
vi.mock('./media.api', () => ({ createMediaDownload: mockCreateDownload }))
afterEach(cleanup)

test('keeps media dimensions stable with a named skeleton while authorizing', () => {
  mockCreateDownload.mockReturnValue(new Promise(() => undefined))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AuthorizedImage objectKey="users/u/image.webp" alt="箱子封面" className="h-full w-full object-cover" />
    </QueryClientProvider>,
  )

  const status = screen.getByRole('status', { name: '正在加载授权图片' })
  expect(status).toHaveClass('h-full', 'w-full', 'object-cover')
  expect(screen.getByTestId('skeleton')).toBeInTheDocument()
  expect(screen.queryByText('图片加载中…')).not.toBeInTheDocument()
})

test('renders an authorized short-lived image URL', async () => {
  mockCreateDownload.mockResolvedValue({
    download_url: 'https://r2.example/signed-image',
    expires_at: '2026-07-30T12:00:00Z',
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AuthorizedImage objectKey="users/u/image.webp" alt="箱子封面" />
    </QueryClientProvider>,
  )

  expect(await screen.findByRole('img', { name: '箱子封面' })).toHaveAttribute(
    'src',
    'https://r2.example/signed-image',
  )
})
