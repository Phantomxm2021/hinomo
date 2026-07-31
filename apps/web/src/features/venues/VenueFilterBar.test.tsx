import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { VenueFilterBar } from './VenueFilterBar'

afterEach(cleanup)

test('keeps the built-in default venue selectable and editable', async () => {
  const user = userEvent.setup()
  const onEdit = vi.fn()
  const onSelect = vi.fn()
  render(<VenueFilterBar
    venues={[
      { id: 'default', name: '默认', description: null, is_default: true, space_count: 0 },
      { id: 'office', name: '公司', description: null, is_default: false, space_count: 2 },
    ]}
    selectedId="default"
    onSelect={onSelect}
    onCreate={vi.fn()}
    onEdit={onEdit}
  />)

  expect(screen.getByRole('button', { name: '默认，0 个空间' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '编辑场地默认' }))
  expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'default' }))
  await user.click(screen.getByRole('button', { name: '编辑场地公司' }))
  expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'office' }))
})
