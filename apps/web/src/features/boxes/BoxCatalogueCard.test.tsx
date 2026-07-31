import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import type { BoxSummary } from './boxes.api'
import { BoxCatalogueCard } from './BoxCatalogueCard'

const { mockAuthorizedImage } = vi.hoisted(() => ({
  mockAuthorizedImage: vi.fn(),
}))

vi.mock('../media/AuthorizedImage', () => ({
  AuthorizedImage: ({ objectKey, alt, className }: { objectKey: string; alt: string; className?: string }) => {
    mockAuthorizedImage({ objectKey, alt, className })
    return <img alt={alt} className={className} src={`signed:${objectKey}`} />
  },
}))

const fallbackBox: BoxSummary = {
  id: 'box-1',
  public_id: 'public-1',
  box_code: 'BX-00001',
  name: '冬季衣物',
  space_id: 'space-1',
  space_name: '卧室',
  location: null,
  visibility: 'private',
  cover_object_key: null,
  item_count: 8,
  updated_at: '2026-07-31T10:00:00Z',
}

function renderCard(overrides: Partial<React.ComponentProps<typeof BoxCatalogueCard>> = {}) {
  const props = {
    box: fallbackBox,
    menuOpen: false,
    onMenuToggle: vi.fn(),
    onMenuClose: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  }

  return {
    ...render(<MemoryRouter><BoxCatalogueCard {...props} /></MemoryRouter>),
    props,
  }
}

afterEach(() => {
  cleanup()
  mockAuthorizedImage.mockReset()
})

test('renders the fallback catalogue card details and primary link', () => {
  renderCard()

  expect(screen.getByRole('link', { name: '打开冬季衣物' })).toHaveAttribute('href', '/b/public-1')
  expect(screen.getByText('卧室 · 未填写位置')).toBeInTheDocument()
  expect(screen.getByText('8 件物品')).toBeInTheDocument()
  expect(screen.getByText('BX-00001')).toBeInTheDocument()
  expect(screen.getByText('私有')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '箱子封面占位图' })).toBeInTheDocument()
})

test('renders the authorized cover image with its object key and alt text', () => {
  const box = { ...fallbackBox, cover_object_key: 'users/u/boxes/box-1.webp' }
  renderCard({ box })

  expect(mockAuthorizedImage).toHaveBeenCalledWith(expect.objectContaining({
    objectKey: 'users/u/boxes/box-1.webp',
    alt: '冬季衣物封面',
  }))
})

test('reports management trigger clicks and its expanded state', async () => {
  const user = userEvent.setup()
  const { props } = renderCard()
  const trigger = screen.getByRole('button', { name: '管理冬季衣物' })

  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await user.click(trigger)
  expect(props.onMenuToggle).toHaveBeenCalledTimes(1)

  const openView = renderCard({ menuOpen: true })
  expect(screen.getAllByRole('button', { name: '管理冬季衣物' })[1]).toHaveAttribute('aria-expanded', 'true')
  openView.unmount()
})

test('provides edit and delete menu actions for the supplied box', async () => {
  const user = userEvent.setup()
  const { props } = renderCard({ menuOpen: true })

  expect(screen.getByRole('link', { name: '编辑冬季衣物' })).toHaveAttribute('href', '/app/boxes/box-1/edit')
  await user.click(screen.getByRole('button', { name: '删除冬季衣物' }))
  expect(props.onDelete).toHaveBeenCalledWith(fallbackBox)
})

test('closes on Escape and restores focus to the management trigger', async () => {
  const { props } = renderCard({ menuOpen: true })
  const trigger = screen.getByRole('button', { name: '管理冬季衣物' })
  screen.getByRole('link', { name: '编辑冬季衣物' }).focus()

  fireEvent.keyDown(document, { key: 'Escape' })

  expect(props.onMenuClose).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(trigger).toHaveFocus())
})

test('closes on outside mousedown but leaves trigger clicks to the parent toggle', async () => {
  const user = userEvent.setup()
  const { props } = renderCard({ menuOpen: true })

  fireEvent.mouseDown(document.body)
  expect(props.onMenuClose).toHaveBeenCalledTimes(1)

  await user.click(screen.getByRole('button', { name: '管理冬季衣物' }))
  expect(props.onMenuToggle).toHaveBeenCalledTimes(1)
  expect(props.onMenuClose).toHaveBeenCalledTimes(1)
})

test('closes the menu after editing or deleting', async () => {
  const user = userEvent.setup()
  const edit = renderCard({ menuOpen: true })

  await user.click(screen.getByRole('link', { name: '编辑冬季衣物' }))
  expect(edit.props.onMenuClose).toHaveBeenCalledTimes(1)
  edit.unmount()

  const remove = renderCard({ menuOpen: true })
  await user.click(screen.getByRole('button', { name: '删除冬季衣物' }))
  expect(remove.props.onMenuClose).toHaveBeenCalledTimes(1)
})
