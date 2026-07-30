import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { autoSpaceLayout } from './space-layout'
import { SpaceMap } from './SpaceMap'

const spaces = [
  { id: 's1', name: '客厅', description: '日常用品', box_count: 6, item_count: 42 },
  { id: 's2', name: '卧室', description: null, box_count: 9, item_count: 67 },
]

afterEach(cleanup)

test('automatically lays out one to twelve rooms inside the canvas', () => {
  for (let total = 1; total <= 12; total += 1) {
    for (let index = 0; index < total; index += 1) {
      const position = autoSpaceLayout(index, total)
      expect(position.x).toBeGreaterThanOrEqual(0)
      expect(position.x).toBeLessThanOrEqual(80)
      expect(position.y).toBeGreaterThanOrEqual(0)
      expect(position.y).toBeLessThanOrEqual(90)
      expect(position.width).toBeGreaterThanOrEqual(20)
      expect(position.width).toBeLessThanOrEqual(60)
      expect(position.height).toBeGreaterThanOrEqual(10)
      expect(position.height).toBeLessThanOrEqual(50)
      expect(position.x + position.width).toBeLessThanOrEqual(100)
      expect(position.y + position.height).toBeLessThanOrEqual(100)
    }
  }
  expect(autoSpaceLayout(0, 12).width).toBeGreaterThanOrEqual(40)
})

test('renders room graphics and links to filtered boxes', () => {
  render(<MemoryRouter><SpaceMap spaces={spaces} layouts={[]} editMode={false} onLayoutChange={vi.fn()} /></MemoryRouter>)

  expect(screen.getByRole('region', { name: '家庭平面总览' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '客厅图标' })).toHaveTextContent('🛋️')
  expect(screen.getByRole('link', { name: /客厅/ })).toHaveAttribute('href', '/app/boxes?space=s1')
  expect(screen.getByRole('link', { name: /客厅/ })).toHaveClass('touch-pan-y')
})

test('moves a focused room by two percent with arrow keys in edit mode', () => {
  const onLayoutChange = vi.fn()
  render(
    <MemoryRouter>
      <SpaceMap
        spaces={spaces}
        layouts={[{ space_id: 's1', x: 4, y: 4, width: 44, height: 42 }]}
        editMode
        onLayoutChange={onLayoutChange}
      />
    </MemoryRouter>,
  )

  fireEvent.keyDown(screen.getByRole('link', { name: /客厅/ }), { key: 'ArrowRight' })

  expect(onLayoutChange).toHaveBeenCalledWith('s1', {
    x: 6, y: 4, width: 44, height: 42,
  })
})

test('snaps pointer dragging and commits the resulting percentage position', () => {
  const onLayoutChange = vi.fn()
  render(
    <MemoryRouter>
      <SpaceMap spaces={[spaces[0]]} layouts={[]} editMode onLayoutChange={onLayoutChange} />
    </MemoryRouter>,
  )
  const map = screen.getByRole('region', { name: '家庭平面总览' })
  vi.spyOn(map, 'getBoundingClientRect').mockReturnValue({
    bottom: 500, height: 500, left: 0, right: 1000, top: 0, width: 1000, x: 0, y: 0, toJSON: () => ({}),
  })
  const room = screen.getByRole('link', { name: /客厅/ })

  fireEvent.pointerDown(room, { clientX: 0, clientY: 0, pointerId: 1 })
  expect(room).toHaveClass('touch-none')
  fireEvent.pointerMove(room, { clientX: 100, clientY: 50, pointerId: 1 })
  fireEvent.pointerUp(room, { pointerId: 1 })

  expect(onLayoutChange).toHaveBeenCalledWith('s1', { x: 30, y: 40, width: 60, height: 42 })
})

test('clears an interrupted pointer drag without saving', () => {
  const onLayoutChange = vi.fn()
  render(
    <MemoryRouter>
      <SpaceMap spaces={[spaces[0]]} layouts={[]} editMode onLayoutChange={onLayoutChange} />
    </MemoryRouter>,
  )
  const room = screen.getByRole('link', { name: /客厅/ })
  const originalStyle = room.getAttribute('style')
  fireEvent.pointerDown(room, { clientX: 0, clientY: 0, pointerId: 1 })
  fireEvent.pointerMove(room, { clientX: 100, clientY: 50, pointerId: 1 })
  fireEvent.pointerCancel(room, { pointerId: 1 })
  fireEvent.pointerUp(room, { pointerId: 1 })

  expect(onLayoutChange).not.toHaveBeenCalled()
  expect(room).toHaveAttribute('style', originalStyle)
})
