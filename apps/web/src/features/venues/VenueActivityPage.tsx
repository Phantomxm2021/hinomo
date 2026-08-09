import { useParams } from 'react-router-dom'
import { VenueActivityPanel } from './VenueActivityPanel'

/** Compatibility wrapper for the existing activity deep-link route. */
export function VenueActivityPage() {
  const { venueId = '' } = useParams<{ venueId: string }>()
  return <VenueActivityPanel venueId={venueId} showHeader />
}
