import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { VenueFilterBar } from './VenueFilterBar'

afterEach(cleanup)

const venueAccess = { owner_id: 'owner-1', role: 'owner' as const, owner_display_name: null, member_count: 1, max_members: 5 }

test('keeps the built-in default venue selectable and editable', async () => {
  const user = userEvent.setup()
  const onEdit = vi.fn()
  const onSelect = vi.fn()
  render(<VenueFilterBar
    venues={[
      { id: 'default', name: '默认', description: null, is_default: true, space_count: 0, ...venueAccess },
      { id: 'office', name: '公司', description: null, is_default: false, space_count: 2, ...venueAccess },
    ]}
    selectedId="default"
    onSelect={onSelect}
    onCreate={vi.fn()}
    onEdit={onEdit}
  />)

  expect(screen.getByRole('button', { name: '默认，0 个空间' })).toBeInTheDocument()
  const renameDefault = screen.getByRole('button', { name: '重命名场地默认' })
  expect(renameDefault).toHaveAttribute('title', '重命名默认')
  await user.click(renameDefault)
  expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'default' }))
  await user.click(screen.getByRole('button', { name: '重命名场地公司' }))
  expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'office' }))
})

test('keeps venue chips horizontally scrollable without reserving space for a scrollbar', () => {
  render(<VenueFilterBar
    venues={[
      { id: 'default', name: '默认', description: null, is_default: true, space_count: 0, ...venueAccess },
    ]}
    selectedId="default"
    onSelect={vi.fn()}
    onCreate={vi.fn()}
    onEdit={vi.fn()}
  />)

  expect(screen.getByRole('group', { name: '选择场地' })).toHaveClass(
    'overflow-x-auto',
    'overscroll-x-contain',
    'venue-filter-scroll',
  )
  expect(screen.getByRole('group', { name: '选择场地' })).not.toHaveClass('pb-1')
})
