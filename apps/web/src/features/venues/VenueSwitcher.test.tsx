import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { VenueSwitcher } from './VenueSwitcher'

afterEach(cleanup)

const venueAccess = { owner_id: 'owner-1', role: 'owner' as const, owner_display_name: null, member_count: 1, max_members: 5 }

test('opens beside the trigger, selects a venue, and links to venue management', async () => {
  const user = userEvent.setup()
  const onSelect = vi.fn()
  render(
    <MemoryRouter>
      <VenueSwitcher
        venues={[
          { id: 'home', name: '家里', description: null, is_default: true, space_count: 3, ...venueAccess },
          { id: 'office', name: '公司', description: null, is_default: false, space_count: 1, ...venueAccess },
        ]}
        selectedId="home"
        onSelect={onSelect}
      />
    </MemoryRouter>,
  )

  const trigger = screen.getByRole('button', { name: '选择场地，家里' })
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(trigger).toHaveClass('h-11', 'pr-0')
  expect(trigger.lastElementChild).toHaveClass('grid', 'place-items-center', 'rotate-90')
  await user.click(trigger)

  const menu = screen.getByRole('menu', { name: '选择场地' })
  expect(menu).toHaveClass('absolute', 'right-0')
  expect(screen.getByRole('menuitem', { name: '场地管理' })).toHaveAttribute('href', '/app/venues')
  await user.click(screen.getByRole('menuitemradio', { name: '公司，1 个空间' }))

  expect(onSelect).toHaveBeenCalledWith('office')
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
})
