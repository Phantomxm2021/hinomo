import { useCallback, useEffect, useState } from 'react'
import type { VenueSummary } from './venues.api'

export const SELECTED_VENUE_STORAGE_KEY = 'nomo-selected-venue-id'

function readSelectedVenueId() {
  try {
    return window.localStorage.getItem(SELECTED_VENUE_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeSelectedVenueId(venueId: string) {
  try {
    window.localStorage.setItem(SELECTED_VENUE_STORAGE_KEY, venueId)
  } catch {
    // Selection still works for the current page when storage is unavailable.
  }
}

export function useSelectedVenue(venues: readonly VenueSummary[]) {
  const [storedId, setStoredId] = useState(readSelectedVenueId)
  const selectedId = venues.some((venue) => venue.id === storedId)
    ? storedId
    : (venues[0]?.id ?? null)

  useEffect(() => {
    if (!selectedId || selectedId === storedId) return
    setStoredId(selectedId)
    writeSelectedVenueId(selectedId)
  }, [selectedId, storedId])

  useEffect(() => {
    const syncSelection = (event: StorageEvent) => {
      if (event.key === SELECTED_VENUE_STORAGE_KEY) setStoredId(event.newValue)
    }
    window.addEventListener('storage', syncSelection)
    return () => window.removeEventListener('storage', syncSelection)
  }, [])

  const selectVenue = useCallback((venueId: string) => {
    setStoredId(venueId)
    writeSelectedVenueId(venueId)
  }, [])

  return [selectedId, selectVenue] as const
}
