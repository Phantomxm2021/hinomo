import { useCallback, useEffect, useState } from 'react'
import type { VenueSummary } from './venues.api'

export const selectedVenueStorageKey = (userId: string) => `nomo-selected-venue-id:${userId}`

function readSelectedVenueId(userId: string | null | undefined) {
  if (!userId) return null
  try {
    return window.localStorage.getItem(selectedVenueStorageKey(userId))
  } catch {
    return null
  }
}

function writeSelectedVenueId(userId: string, venueId: string) {
  try {
    window.localStorage.setItem(selectedVenueStorageKey(userId), venueId)
  } catch {
    // Selection still works for the current page when storage is unavailable.
  }
}

export function useSelectedVenue(venues: readonly VenueSummary[], userId: string | null | undefined) {
  const [selection, setSelection] = useState(() => ({ userId, venueId: readSelectedVenueId(userId) }))
  const selectionReady = selection.userId === userId
  const storedId = selectionReady ? selection.venueId : null
  const selectedId = venues.some((venue) => venue.id === storedId)
    ? storedId
    : (venues[0]?.id ?? null)

  useEffect(() => {
    setSelection({ userId, venueId: readSelectedVenueId(userId) })
  }, [userId])

  useEffect(() => {
    if (!userId) return
    if (!selectionReady) return
    if (!selectedId || selectedId === storedId) return
    setSelection({ userId, venueId: selectedId })
    writeSelectedVenueId(userId, selectedId)
  }, [selectedId, selectionReady, storedId, userId])

  useEffect(() => {
    if (!userId) return
    const storageKey = selectedVenueStorageKey(userId)
    const syncSelection = (event: StorageEvent) => {
      if (event.key === storageKey) setSelection({ userId, venueId: event.newValue })
    }
    window.addEventListener('storage', syncSelection)
    return () => window.removeEventListener('storage', syncSelection)
  }, [userId])

  const selectVenue = useCallback((venueId: string) => {
    if (!userId) return
    setSelection({ userId, venueId })
    writeSelectedVenueId(userId, venueId)
  }, [userId])

  return [selectedId, selectVenue] as const
}
