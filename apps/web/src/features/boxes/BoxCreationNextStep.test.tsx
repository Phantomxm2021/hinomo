import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { BoxCreationNextStep } from './BoxCreationNextStep'

const { mockBoxQrPng } = vi.hoisted(() => ({ mockBoxQrPng: vi.fn() }))

vi.mock('../qr-print/qr', () => ({
  boxQrUrl: (_origin: string, publicId: string) => `https://nomo.test/b/${publicId}`,
  boxQrPng: mockBoxQrPng,
}))

test('offers an in-app next step and a desktop phone handoff QR', async () => {
  mockBoxQrPng.mockResolvedValue('data:image/png;base64,handoff')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <BoxCreationNextStep box={{ id: 'box-1', public_id: 'public-1', box_code: 'BX-1', name: '露营用品' }} />
      </QueryClientProvider>
    </MemoryRouter>,
  )

  const success = screen.getByRole('status', { name: '箱子已创建' })
  expect(within(success).getByRole('link', { name: '记录箱内物品' })).toHaveAttribute('href', '/b/public-1')
  expect(within(success).getByLabelText('用手机继续记录')).toHaveClass('hidden', 'lg:flex')
  expect(await within(success).findByRole('img', { name: '手机录入接力二维码' })).toHaveAttribute('src', 'data:image/png;base64,handoff')
  expect(mockBoxQrPng).toHaveBeenCalledWith('https://nomo.test/b/public-1?capture=1')
})
