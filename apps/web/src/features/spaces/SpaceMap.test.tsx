import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { autoSpaceLayout, constrainResize } from './space-layout'
import { SpaceMap } from './SpaceMap'

const spaces = [
  { id: 's1', venue_id: 'home', venue_name: '家里', name: '客厅', description: '日常用品', box_count: 6, item_count: 42 },
  { id: 's2', venue_id: 'home', venue_name: '家里', name: '卧室', description: null, box_count: 9, item_count: 67 },
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

test('resizes freely while constraining size to canvas boundaries', () => {
  expect(constrainResize({ x: 10, y: 10, width: 20, height: 20 }, 17, 19)).toEqual({
    x: 10, y: 10, width: 37, height: 39,
  })
  expect(constrainResize({ x: 70, y: 70, width: 20, height: 10 }, 17, 19)).toEqual({
    x: 70, y: 70, width: 30, height: 29,
  })
  expect(constrainResize({ x: 10, y: 10, width: 40, height: 30 }, -99, -99)).toEqual({
    x: 10, y: 10, width: 8, height: 8,
  })
  expect(constrainResize({ x: 0, y: 0, width: 40, height: 30 }, 99, 99)).toEqual({
    x: 0, y: 0, width: 100, height: 100,
  })
})

test('resizes from the card lower-right corner without showing controls', () => {
  const onLayoutChange = vi.fn()
  render(
    <MemoryRouter>
      <SpaceMap
        spaces={[spaces[0]]}
        layouts={[{ space_id: 's1', x: 10, y: 10, width: 40, height: 30 }]}
        editMode
        onLayoutChange={onLayoutChange}
      />
    </MemoryRouter>,
  )

  expect(screen.queryByRole('region', { name: '调整客厅尺寸' })).not.toBeInTheDocument()
  expect(screen.queryByRole('slider', { name: '客厅宽度' })).not.toBeInTheDocument()
  expect(screen.queryByRole('slider', { name: '客厅长度' })).not.toBeInTheDocument()

  const map = screen.getByRole('region', { name: '空间平面总览' })
  vi.spyOn(map, 'getBoundingClientRect').mockReturnValue({
    bottom: 500, height: 500, left: 0, right: 1000, top: 0, width: 1000, x: 0, y: 0, toJSON: () => ({}),
  })
  const room = screen.getByRole('button', { name: '调整客厅位置和尺寸' })
  vi.spyOn(room, 'getBoundingClientRect').mockReturnValue({
    bottom: 250, height: 150, left: 100, right: 500, top: 100, width: 400, x: 100, y: 100, toJSON: () => ({}),
  })
  fireEvent.pointerDown(room, { clientX: 495, clientY: 245, pointerId: 1 })
  fireEvent.pointerMove(room, { clientX: 695, clientY: 345, pointerId: 1 })
  fireEvent.pointerUp(room, { pointerId: 1 })

  expect(onLayoutChange).toHaveBeenCalledWith('s1', { x: 10, y: 10, width: 60, height: 50 })
})

test('renders room graphics and links to filtered boxes', () => {
  render(<MemoryRouter><SpaceMap spaces={spaces} layouts={[]} editMode={false} onLayoutChange={vi.fn()} /></MemoryRouter>)

  expect(screen.getByRole('region', { name: '空间平面总览' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '客厅图标' })).toHaveTextContent('🛋️')
  expect(screen.getByRole('link', { name: /客厅/ })).toHaveAttribute('href', '/app/boxes?space=s1')
  expect(screen.getByRole('link', { name: /客厅/ })).toHaveClass('touch-pan-y')
})

test('disables the anchor native drag gesture', () => {
  render(<MemoryRouter><SpaceMap spaces={spaces} layouts={[]} editMode onLayoutChange={vi.fn()} /></MemoryRouter>)
  const room = screen.getByRole('link', { name: /客厅/ })

  expect(room).toHaveAttribute('draggable', 'false')
  expect(fireEvent.dragStart(room)).toBe(false)
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

  fireEvent.keyDown(screen.getByRole('button', { name: '调整客厅位置和尺寸' }), { key: 'ArrowRight' })

  expect(onLayoutChange).toHaveBeenCalledWith('s1', {
    x: 6, y: 4, width: 44, height: 42,
  })
})

test('drags an entire edit-mode card to commit its resulting position', () => {
  const onLayoutChange = vi.fn()
  render(
    <MemoryRouter>
      <SpaceMap spaces={[spaces[0]]} layouts={[]} editMode onLayoutChange={onLayoutChange} />
    </MemoryRouter>,
  )
  const map = screen.getByRole('region', { name: '空间平面总览' })
  vi.spyOn(map, 'getBoundingClientRect').mockReturnValue({
    bottom: 500, height: 500, left: 0, right: 1000, top: 0, width: 1000, x: 0, y: 0, toJSON: () => ({}),
  })
  const room = screen.getByRole('button', { name: '调整客厅位置和尺寸' })

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
  const room = screen.getByRole('button', { name: '调整客厅位置和尺寸' })
  const originalStyle = room.getAttribute('style')
  fireEvent.pointerDown(room, { clientX: 0, clientY: 0, pointerId: 1 })
  fireEvent.pointerMove(room, { clientX: 100, clientY: 50, pointerId: 1 })
  fireEvent.pointerCancel(room, { pointerId: 1 })
  fireEvent.pointerUp(room, { pointerId: 1 })

  expect(onLayoutChange).not.toHaveBeenCalled()
  expect(room).toHaveAttribute('style', originalStyle)
})

test('keeps direct manipulation free of resize controls', () => {
  const onLayoutChange = vi.fn()
  render(
    <MemoryRouter>
      <SpaceMap
        spaces={[spaces[0]]}
        layouts={[{ space_id: 's1', x: 10, y: 10, width: 40, height: 30 }]}
        editMode
        onLayoutChange={onLayoutChange}
      />
    </MemoryRouter>,
  )

  expect(screen.queryByRole('button', { name: '调整客厅宽度' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '调整客厅长度' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '调整客厅大小' })).not.toBeInTheDocument()
})
