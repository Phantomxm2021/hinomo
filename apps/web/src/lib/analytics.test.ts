import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureGrowthEvent } from './analytics'

const { mockCapture, mockIdentify, mockInit, mockOptInCapturing, mockOptOutCapturing, mockReset } = vi.hoisted(() => ({
  mockCapture: vi.fn(),
  mockIdentify: vi.fn(),
  mockInit: vi.fn(),
  mockOptInCapturing: vi.fn(),
  mockOptOutCapturing: vi.fn(),
  mockReset: vi.fn(),
}))

vi.mock('posthog-js/dist/module.no-external', () => ({
  default: {
    capture: mockCapture,
    identify: mockIdentify,
    init: mockInit,
    opt_in_capturing: mockOptInCapturing,
    opt_out_capturing: mockOptOutCapturing,
    reset: mockReset,
  },
}))

async function loadAnalytics() {
  vi.resetModules()
  vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test')
  vi.stubEnv('VITE_POSTHOG_HOST', 'https://eu.i.posthog.com')
  return import('./analytics')
}

function installStorage() {
  const values = new Map<string, string>()
  const storage: Storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size },
  }
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
}

describe('analytics boundary', () => {
  beforeEach(() => {
    installStorage()
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => vi.unstubAllEnvs())

  it('does not initialize or capture before consent', async () => {
    const { captureGrowthEvent, getAnalyticsConsent } = await loadAnalytics()

    expect(getAnalyticsConsent()).toBe('unset')
    captureGrowthEvent('landing_view', {
      campaign: 'three_box_reset', language: 'en-US', device: 'mobile', first: true,
    })

    expect(mockInit).not.toHaveBeenCalled()
    expect(mockCapture).not.toHaveBeenCalled()
  })

  it('initializes only after consent with automatic and recording capture disabled', async () => {
    const { setAnalyticsConsent } = await loadAnalytics()

    setAnalyticsConsent('accepted')

    await vi.waitFor(() => {
      expect(mockInit).toHaveBeenCalledWith('phc_test', expect.objectContaining({
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        opt_out_capturing_by_default: true,
      }))
      expect(mockOptInCapturing).toHaveBeenCalledOnce()
    })
  })

  it('identifies and resets only the supplied user id after consent', async () => {
    const { identifyAnalyticsUser, resetAnalyticsUser, setAnalyticsConsent } = await loadAnalytics()
    setAnalyticsConsent('accepted')

    identifyAnalyticsUser('00000000-0000-4000-8000-000000000001')
    await vi.waitFor(() => expect(mockIdentify).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001'))

    resetAnalyticsUser()
    expect(mockReset).toHaveBeenCalledOnce()
  })

  it('marks a first occurrence only after analytics consent', async () => {
    const { firstGrowthOccurrence, setAnalyticsConsent } = await loadAnalytics()

    expect(firstGrowthOccurrence('space_created')).toBe(true)
    expect(localStorage.getItem('nomo-growth-first:space_created')).toBeNull()

    setAnalyticsConsent('accepted')
    expect(firstGrowthOccurrence('space_created')).toBe(true)
    expect(firstGrowthOccurrence('space_created')).toBe(false)
    expect(localStorage.getItem('nomo-growth-first:space_created')).toBe('1')
  })

  it('opts out if a user later withdraws consent', async () => {
    const { setAnalyticsConsent } = await loadAnalytics()
    setAnalyticsConsent('accepted')
    await vi.waitFor(() => expect(mockInit).toHaveBeenCalledOnce())

    setAnalyticsConsent('declined')

    expect(mockOptOutCapturing).toHaveBeenCalledOnce()
  })
})

if (import.meta.env.MODE === '__compile_assertion__') {
  // @ts-expect-error Growth events never contain searched content.
  captureGrowthEvent('first_search_completed', { search_text: 'cable', has_results: true, first: true })
  // @ts-expect-error Checkout products are a closed, approved set.
  captureGrowthEvent('checkout_started', { product: 'enterprise' })
}
