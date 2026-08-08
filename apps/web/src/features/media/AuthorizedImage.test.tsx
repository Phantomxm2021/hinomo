import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, type PropsWithChildren } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider, useI18n } from '../../i18n/I18nProvider'
import { AuthorizedImage } from './AuthorizedImage'

const { mockCreateDownload } = vi.hoisted(() => ({ mockCreateDownload: vi.fn() }))
vi.mock('./media.api', () => ({ createMediaDownload: mockCreateDownload }))
beforeEach(() => {
  mockCreateDownload.mockReset()
})
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
  mockCreateDownload
    .mockRejectedValueOnce(new Error('network'))
    .mockRejectedValueOnce(new Error('network'))
    .mockReturnValueOnce(new Promise(() => undefined))
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
  const retrying = within(alert).getByRole('button', { name: '重试中…' })
  expect(retrying).toBeDisabled()
  expect(retrying).toHaveAttribute('aria-busy', 'true')
  await user.click(retrying)
  await waitFor(() => expect(mockCreateDownload).toHaveBeenCalledTimes(3))
})

test('localizes authorization and retry states in English', async () => {
  mockCreateDownload.mockReturnValue(new Promise(() => undefined))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function EnglishProvider({ children }: PropsWithChildren) {
    const { setLocale } = useI18n()
    useEffect(() => setLocale('en-US'), [setLocale])
    return <>{children}</>
  }
  render(
    <I18nProvider>
      <EnglishProvider>
        <QueryClientProvider client={client}>
          <AuthorizedImage objectKey="users/u/image.webp" alt="Box cover" />
        </QueryClientProvider>
      </EnglishProvider>
    </I18nProvider>,
  )

  expect(screen.getByRole('status', { name: 'Loading authorized image' })).toBeInTheDocument()
})
