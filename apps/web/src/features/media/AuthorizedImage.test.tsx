import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  expect(screen.getByTestId('skeleton')).toHaveClass('min-h-16')
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

test('shows the unavailable alternative when authorization initially fails', async () => {
  mockCreateDownload.mockRejectedValue(new Error('network'))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AuthorizedImage objectKey="users/u/image.webp" alt="箱子封面" />
    </QueryClientProvider>,
  )

  expect(await screen.findByText('图片暂不可用', {}, { timeout: 4_000 })).toBeInTheDocument()
  expect(screen.queryByRole('img', { name: '箱子封面' })).not.toBeInTheDocument()
})

test('keeps a cached image and its geometry while a refetch fails', async () => {
  const user = userEvent.setup()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['media-url', 'users/u/image.webp'], {
    download_url: 'https://r2.example/cached-image',
    expires_at: '2026-07-30T12:00:00Z',
  }, { updatedAt: 1 })
  mockCreateDownload.mockRejectedValue(new Error('network'))
  render(
    <QueryClientProvider client={client}>
      <AuthorizedImage objectKey="users/u/image.webp" alt="箱子封面" className="block h-full w-full object-cover" />
    </QueryClientProvider>,
  )

  const image = await screen.findByRole('img', { name: '箱子封面' })
  expect(image).toHaveAttribute('src', 'https://r2.example/cached-image')
  expect(image).toHaveClass('block', 'h-full', 'w-full', 'object-cover')
  const alert = await screen.findByRole('alert', {}, { timeout: 4_000 })
  expect(alert.parentElement).toHaveClass('relative', 'h-full', 'w-full')
  await user.click(within(alert).getByRole('button', { name: '重试加载图片' }))
  await waitFor(() => expect(mockCreateDownload.mock.calls.length).toBeGreaterThanOrEqual(3))
})
