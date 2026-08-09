import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthProvider } from '../features/auth/AuthProvider'
import { AccountQueryBoundary } from './AccountQueryBoundary'

function VenueProbe() {
  const queryClient = useQueryClient()
  const venues = queryClient.getQueryData<{ name: string }[]>(['venues']) ?? []
  return <p>{venues.map((venue) => venue.name).join(',') || 'no venues'}</p>
}

function accountTree(client: QueryClient, userId: string | null, children: ReactNode) {
  return (
    <QueryClientProvider client={client}>
      <AuthProvider session={userId ? { user: { id: userId } } as never : null}>
        <AccountQueryBoundary>{children}</AccountQueryBoundary>
      </AuthProvider>
    </QueryClientProvider>
  )
}

describe('AccountQueryBoundary', () => {
  afterEach(cleanup)

  it('clears private query data before rendering the next account', async () => {
    const client = new QueryClient()
    client.setQueryData(['venues'], [{ name: 'User A venue' }])
    const view = render(accountTree(client, 'user-a', <VenueProbe />))

    expect(screen.getByText('User A venue')).toBeInTheDocument()

    view.rerender(accountTree(client, 'user-b', <VenueProbe />))

    expect(screen.queryByText('User A venue')).not.toBeInTheDocument()
    await waitFor(() => expect(client.getQueryData(['venues'])).toBeUndefined())
    expect(screen.getByText('no venues')).toBeInTheDocument()
  })

  it('clears private query data before rendering after logout', async () => {
    const client = new QueryClient()
    client.setQueryData(['venues'], [{ name: 'User A venue' }])
    const view = render(accountTree(client, 'user-a', <VenueProbe />))

    expect(screen.getByText('User A venue')).toBeInTheDocument()

    view.rerender(accountTree(client, null, <VenueProbe />))

    expect(screen.queryByText('User A venue')).not.toBeInTheDocument()
    await waitFor(() => expect(client.getQueryData(['venues'])).toBeUndefined())
  })
})
