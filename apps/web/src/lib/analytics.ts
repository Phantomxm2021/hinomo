import { env } from './env'

export type AnalyticsConsent = 'unset' | 'accepted' | 'declined'
export type DeviceCategory = 'mobile' | 'tablet' | 'desktop'
export type CheckoutProduct = 'founding_lifetime' | 'credits_20' | 'credits_100' | 'credits_500'

export type GrowthEventMap = {
  landing_view: { campaign: 'three_box_reset'; language: 'en-US' | 'zh-CN'; device: DeviceCategory; first: boolean }
  signup_completed: { campaign: 'three_box_reset' | 'organic'; language: 'en-US' | 'zh-CN'; contact_opt_in: boolean }
  space_created: { onboarding: boolean; first: boolean }
  box_created: { onboarding: boolean; first: boolean }
  first_item_created: { onboarding: boolean; method: 'manual' | 'ai'; first: boolean }
  ai_analysis_completed: { result: 'ready' | 'partial'; first: boolean }
  first_search_completed: { has_results: boolean; first: boolean }
  qr_downloaded: { format: 'pdf'; first: boolean }
  qr_scanned: { destination: 'box'; first: boolean }
  checkout_started: { product: CheckoutProduct }
  purchase_completed: { product: CheckoutProduct; confirmation: 'checkout_return' | 'entitlement_confirmed' }
}

export type FirstGrowthEventName = Exclude<keyof GrowthEventMap, 'checkout_started' | 'purchase_completed'>

const consentKey = 'nomo-analytics-consent'
const firstOccurrencePrefix = 'nomo-growth-first:'
const listeners = new Set<() => void>()
type PostHogClient = typeof import('posthog-js/dist/module.no-external').default

let posthog: PostHogClient | null = null
let initialization: Promise<PostHogClient | null> | null = null
let initialized = false

function browserStorage() {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function hasAnalyticsConfiguration() {
  return Boolean(env.VITE_POSTHOG_KEY && env.VITE_POSTHOG_HOST)
}

function initializeAnalytics(): Promise<PostHogClient | null> {
  if (getAnalyticsConsent() !== 'accepted' || !hasAnalyticsConfiguration()) return Promise.resolve(null)
  if (initialized && posthog) {
    posthog.opt_in_capturing()
    return Promise.resolve(posthog)
  }
  if (!initialization) {
    const loading = import('posthog-js/dist/module.no-external').then(({ default: client }) => {
      if (getAnalyticsConsent() !== 'accepted') return null
      client.init(env.VITE_POSTHOG_KEY!, {
        api_host: env.VITE_POSTHOG_HOST,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        defaults: '2026-05-30',
        disable_session_recording: true,
        opt_out_capturing_by_default: true,
        persistence: 'localStorage+cookie',
        person_profiles: 'identified_only',
      })
      posthog = client
      initialized = true
      client.opt_in_capturing()
      return client
    }).catch(() => null)
    initialization = loading.then((client) => {
      if (!client) initialization = null
      return client
    })
  }
  return initialization
}

export function getAnalyticsConsent(): AnalyticsConsent {
  const savedConsent = browserStorage()?.getItem(consentKey)
  return savedConsent === 'accepted' || savedConsent === 'declined' ? savedConsent : 'unset'
}

export function subscribeAnalyticsConsent(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setAnalyticsConsent(consent: Exclude<AnalyticsConsent, 'unset'>) {
  browserStorage()?.setItem(consentKey, consent)
  if (consent === 'accepted') void initializeAnalytics()
  if (consent === 'declined' && initialized) posthog?.opt_out_capturing()
  listeners.forEach((listener) => listener())
}

export function captureGrowthEvent<K extends keyof GrowthEventMap>(name: K, properties: GrowthEventMap[K]): void {
  if (getAnalyticsConsent() !== 'accepted') return
  void initializeAnalytics().then((client) => {
    if (client && getAnalyticsConsent() === 'accepted') client.capture(name, properties)
  })
}

export function firstGrowthOccurrence(name: FirstGrowthEventName): boolean {
  if (getAnalyticsConsent() !== 'accepted') return true

  const storage = browserStorage()
  if (!storage) return true
  const key = `${firstOccurrencePrefix}${name}`
  if (storage.getItem(key) === '1') return false
  storage.setItem(key, '1')
  return true
}

export function identifyAnalyticsUser(userId: string): void {
  if (getAnalyticsConsent() !== 'accepted') return
  void initializeAnalytics().then((client) => {
    if (client && getAnalyticsConsent() === 'accepted') client.identify(userId)
  })
}

export function resetAnalyticsUser(): void {
  if (initialized) posthog?.reset()
}

void initializeAnalytics()
