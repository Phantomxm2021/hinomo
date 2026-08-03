import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { PackingPhoto } from './packing.api'
import { PackingPhotoDeck } from './PackingPhotoDeck'

vi.mock('./PackingAuthorizedImage', () => ({
  PackingAuthorizedImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

afterEach(cleanup)

function photo(sequenceNo: number): PackingPhoto {
  return {
    id: `photo-${sequenceNo}`,
    session_id: 'session-1',
    box_id: 'box-1',
    owner_id: 'owner-1',
    sequence_no: sequenceNo,
    object_key: `packing/${sequenceNo}.webp`,
    normalized_object_key: null,
    mime_type: 'image/webp',
    size_bytes: 100,
    width: 1200,
    height: 900,
    sha256: null,
    perceptual_hash: null,
    quality_flags: [],
    upload_status: 'confirmed',
    upload_expires_at: '2026-08-03T01:00:00Z',
    confirmed_at: '2026-08-03T00:00:00Z',
    created_at: '2026-08-03T00:00:00Z',
    updated_at: '2026-08-03T00:00:00Z',
  }
}

test('shows the newest photo first and supports button navigation', () => {
  render(<PackingPhotoDeck photos={[photo(3), photo(1), photo(2)]} />)

  expect(screen.getByRole('img', { name: '第 3 张装箱照片' })).toBeInTheDocument()
  expect(screen.getByText('3 / 3')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '上一张照片' }))
  expect(screen.getByRole('img', { name: '第 2 张装箱照片' })).toBeInTheDocument()
  expect(screen.getByText('2 / 3')).toBeInTheDocument()
})

test('switches photos with horizontal swipes', () => {
  render(<PackingPhotoDeck photos={[photo(1), photo(2), photo(3)]} />)
  const deck = screen.getByRole('region', { name: '已拍照片' }).firstElementChild as HTMLElement

  fireEvent.pointerDown(deck, { pointerId: 1, clientX: 180 })
  fireEvent.pointerUp(deck, { pointerId: 1, clientX: 90 })
  expect(screen.getByText('3 / 3')).toBeInTheDocument()

  fireEvent.pointerDown(deck, { pointerId: 2, clientX: 90 })
  fireEvent.pointerUp(deck, { pointerId: 2, clientX: 180 })
  expect(screen.getByRole('img', { name: '第 2 张装箱照片' })).toBeInTheDocument()
})

test('automatically follows a newly uploaded photo', () => {
  const view = render(<PackingPhotoDeck photos={[photo(1), photo(2)]} />)
  fireEvent.click(screen.getByRole('button', { name: '上一张照片' }))
  expect(screen.getByText('1 / 2')).toBeInTheDocument()

  view.rerender(<PackingPhotoDeck photos={[photo(1), photo(2), photo(3)]} />)
  expect(screen.getByRole('img', { name: '第 3 张装箱照片' })).toBeInTheDocument()
  expect(screen.getByText('3 / 3')).toBeInTheDocument()
})

test('offers removal only for the active photo', () => {
  const onRemove = vi.fn()
  render(<PackingPhotoDeck photos={[photo(1), photo(2)]} onRemove={onRemove} />)

  fireEvent.click(screen.getByRole('button', { name: '移除第 2 张照片' }))

  expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: 'photo-2' }))
  expect(screen.queryByRole('button', { name: '移除第 1 张照片' })).not.toBeInTheDocument()
})
