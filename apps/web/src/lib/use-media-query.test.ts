import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { useMediaQuery } from './use-media-query'

const originalMatchMedia = window.matchMedia

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: originalMatchMedia,
  })
})

test('returns false when matchMedia is unavailable', () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: undefined,
  })

  const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'))

  expect(result.current).toBe(false)
})

test('tracks media query changes and removes the listener on unmount', async () => {
  let listener: ((event: MediaQueryListEvent) => void) | undefined
  const addEventListener = vi.fn()
  const removeEventListener = vi.fn()
  addEventListener.mockImplementation((_type: string, callback: (event: MediaQueryListEvent) => void) => {
    listener = callback
  })
  const mediaQuery = {
    matches: false,
    media: '(min-width: 1024px)',
    onchange: null,
    addEventListener,
    removeEventListener,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => mediaQuery),
  })

  const { result, unmount } = renderHook(() => useMediaQuery('(min-width: 1024px)'))
  expect(result.current).toBe(false)

  listener?.({ matches: true } as MediaQueryListEvent)
  await waitFor(() => expect(result.current).toBe(true))

  unmount()
  expect(removeEventListener).toHaveBeenCalledWith('change', listener)
})
