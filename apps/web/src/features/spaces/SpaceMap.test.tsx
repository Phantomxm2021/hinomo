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

test('snaps resizing and constrains it to size and canvas boundaries', () => {
  expect(constrainResize({ x: 70, y: 70, width: 20, height: 10 }, 17, 19)).toEqual({
    x: 70, y: 70, width: 30, height: 30,
  })
  expect(constrainResize({ x: 10, y: 10, width: 40, height: 30 }, -99, -99)).toEqual({
    x: 10, y: 10, width: 12, height: 12,
  })
  expect(constrainResize({ x: 0, y: 0, width: 40, height: 30 }, 99, 99)).toEqual({
    x: 0, y: 0, width: 100, height: 100,
  })
})

test('offers touch-friendly width and length controls for the selected space', () => {
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

  expect(screen.getByRole('region', { name: '调整客厅尺寸' })).toBeInTheDocument()
  const width = screen.getByRole('slider', { name: '客厅宽度' })
  const length = screen.getByRole('slider', { name: '客厅长度' })
  fireEvent.change(width, { target: { value: '70' } })
  fireEvent.change(length, { target: { value: '64' } })

  expect(onLayoutChange).toHaveBeenNthCalledWith(1, 's1', { x: 10, y: 10, width: 70, height: 30 })
  expect(onLayoutChange).toHaveBeenNthCalledWith(2, 's1', { x: 10, y: 10, width: 70, height: 64 })
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
  const map = screen.getByRole('region', { name: '空间平面总览' })
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
  const roomFrame = room.parentElement
  const originalStyle = roomFrame?.getAttribute('style')
  fireEvent.pointerDown(room, { clientX: 0, clientY: 0, pointerId: 1 })
  fireEvent.pointerMove(room, { clientX: 100, clientY: 50, pointerId: 1 })
  fireEvent.pointerCancel(room, { pointerId: 1 })
  fireEvent.pointerUp(room, { pointerId: 1 })

  expect(onLayoutChange).not.toHaveBeenCalled()
  expect(roomFrame).toHaveAttribute('style', originalStyle)
})

test('resizes a room from its bottom-right handle and commits once', () => {
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
  const map = screen.getByRole('region', { name: '空间平面总览' })
  vi.spyOn(map, 'getBoundingClientRect').mockReturnValue({
    bottom: 500, height: 500, left: 0, right: 1000, top: 0, width: 1000, x: 0, y: 0, toJSON: () => ({}),
  })
  const handle = screen.getByRole('button', { name: '调整客厅大小' })

  fireEvent.pointerDown(handle, { clientX: 400, clientY: 150, pointerId: 2 })
  fireEvent.pointerMove(handle, { clientX: 520, clientY: 200, pointerId: 2 })
  fireEvent.pointerUp(handle, { pointerId: 2 })

  expect(onLayoutChange).toHaveBeenCalledTimes(1)
  expect(onLayoutChange).toHaveBeenCalledWith('s1', {
    x: 10, y: 10, width: 52, height: 40,
  })
})

test('supports keyboard resizing and cancels an interrupted pointer resize', () => {
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
  const handle = screen.getByRole('button', { name: '调整客厅大小' })

  fireEvent.keyDown(handle, { key: 'ArrowRight' })
  expect(onLayoutChange).toHaveBeenLastCalledWith('s1', {
    x: 10, y: 10, width: 42, height: 30,
  })

  onLayoutChange.mockClear()
  fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 3 })
  fireEvent.pointerMove(handle, { clientX: 100, clientY: 100, pointerId: 3 })
  fireEvent.pointerCancel(handle, { pointerId: 3 })
  fireEvent.pointerUp(handle, { pointerId: 3 })

  expect(onLayoutChange).not.toHaveBeenCalled()
})

test('adjusts width and length independently with edge handles', () => {
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

  const widthHandle = screen.getByRole('button', { name: '调整客厅宽度' })
  const lengthHandle = screen.getByRole('button', { name: '调整客厅长度' })
  expect(widthHandle).toHaveClass('cursor-ew-resize')
  expect(lengthHandle).toHaveClass('cursor-ns-resize')

  fireEvent.keyDown(widthHandle, { key: 'ArrowRight' })
  expect(onLayoutChange).toHaveBeenLastCalledWith('s1', {
    x: 10, y: 10, width: 42, height: 30,
  })

  fireEvent.keyDown(lengthHandle, { key: 'ArrowDown' })
  expect(onLayoutChange).toHaveBeenLastCalledWith('s1', {
    x: 10, y: 10, width: 42, height: 32,
  })
})
