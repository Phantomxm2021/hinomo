import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
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
  venue_name: '家里',
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
    onEdit: vi.fn(),
    ...overrides,
  }

  return {
    ...render(<MemoryRouter><BoxCatalogueCard {...props} /></MemoryRouter>),
    props,
  }
}

function StatefulCardHarness({ onClose, onDelete = vi.fn(), onEdit = vi.fn() }: { onClose: () => void; onDelete?: (box: BoxSummary, trigger: HTMLButtonElement | null) => void; onEdit?: (box: BoxSummary, trigger: HTMLButtonElement | null) => void }) {
  const [menuOpen, setMenuOpen] = useState(true)
  return (
    <MemoryRouter>
      <BoxCatalogueCard
        box={fallbackBox}
        menuOpen={menuOpen}
        onMenuToggle={vi.fn()}
        onMenuClose={() => {
          onClose()
          setMenuOpen(false)
        }}
        onDelete={onDelete}
        onEdit={onEdit}
      />
      <button type="button">外部操作</button>
    </MemoryRouter>
  )
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
}

afterEach(() => {
  cleanup()
  mockAuthorizedImage.mockReset()
})

test('renders the fallback catalogue card details and primary link', () => {
  renderCard()

  expect(screen.getByRole('link', { name: '打开冬季衣物' })).toHaveAttribute('href', '/b/public-1')
  expect(screen.getByText('家里 · 卧室 · 未填写位置')).toBeInTheDocument()
  expect(screen.getByText('8 件物品')).toBeInTheDocument()
  expect(screen.getByText('BX-00001')).toBeInTheDocument()
  expect(screen.getByText('私有')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '箱子封面占位图' })).toBeInTheDocument()
})

test('keeps the stretched primary link focus treatment inside the clipped card', () => {
  renderCard()

  expect(screen.getByRole('link', { name: '打开冬季衣物' })).toHaveClass('focus-visible:outline-offset-[-3px]')
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

test('provides button edit and delete menu actions for the supplied box', async () => {
  const user = userEvent.setup()
  const { props } = renderCard({ menuOpen: true })

  await user.click(screen.getByRole('button', { name: '编辑冬季衣物' }))
  expect(props.onEdit).toHaveBeenCalledWith(fallbackBox, screen.getByRole('button', { name: '管理冬季衣物' }))
  await user.click(screen.getByRole('button', { name: '删除冬季衣物' }))
  expect(props.onDelete).toHaveBeenCalledWith(fallbackBox, screen.getByRole('button', { name: '管理冬季衣物' }))
})

test('closes on Escape and restores focus to the management trigger', async () => {
  const onClose = vi.fn()
  render(<StatefulCardHarness onClose={onClose} />)
  const trigger = screen.getByRole('button', { name: '管理冬季衣物' })
  screen.getByRole('button', { name: '编辑冬季衣物' }).focus()

  fireEvent.keyDown(document, { key: 'Escape' })

  expect(onClose).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: '编辑冬季衣物' })).not.toBeInTheDocument()
  await waitFor(() => expect(trigger).toHaveFocus())
})

test('outside interaction closes once and preserves focus on the outside control', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(<StatefulCardHarness onClose={onClose} />)
  const outsideButton = screen.getByRole('button', { name: '外部操作' })

  await user.click(outsideButton)
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: '编辑冬季衣物' })).not.toBeInTheDocument()
  await nextAnimationFrame()
  expect(outsideButton).toHaveFocus()

  fireEvent.mouseDown(document.body)
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('deleting closes without returning focus to the management trigger', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const onDelete = vi.fn()
  render(<StatefulCardHarness onClose={onClose} onDelete={onDelete} />)
  const trigger = screen.getByRole('button', { name: '管理冬季衣物' })

  await user.click(screen.getByRole('button', { name: '删除冬季衣物' }))

  expect(onDelete).toHaveBeenCalledWith(fallbackBox, trigger)
  expect(onClose).toHaveBeenCalledTimes(1)
  await nextAnimationFrame()
  expect(trigger).not.toHaveFocus()
})

test('clicking the management trigger is ignored by the outside handler', async () => {
  const user = userEvent.setup()
  const { props } = renderCard({ menuOpen: true })

  await user.click(screen.getByRole('button', { name: '管理冬季衣物' }))
  expect(props.onMenuToggle).toHaveBeenCalledTimes(1)
  expect(props.onMenuClose).not.toHaveBeenCalled()
})

test('closes the menu after editing or deleting', async () => {
  const user = userEvent.setup()
  const edit = renderCard({ menuOpen: true })

  await user.click(screen.getByRole('button', { name: '编辑冬季衣物' }))
  expect(edit.props.onMenuClose).toHaveBeenCalledTimes(1)
  edit.unmount()

  const remove = renderCard({ menuOpen: true })
  await user.click(screen.getByRole('button', { name: '删除冬季衣物' }))
  expect(remove.props.onMenuClose).toHaveBeenCalledTimes(1)
})
