import { useParams } from 'react-router-dom'
import { VenueMembersPanel } from './VenueMembersPanel'

export function VenueMembersPage() {
  const { venueId = '' } = useParams<{ venueId: string }>()
  const invitesEnabled = import.meta.env.VITE_ENABLE_VENUE_INVITES === 'true'
  return <VenueMembersPanel venueId={venueId} invitesEnabled={invitesEnabled} showHeader />
}
