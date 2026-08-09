import { matchRoutes } from 'react-router-dom'
import { expect, test } from 'vitest'
import { router } from './router'

test('matches the AI credit store before the app fallback route', () => {
  const matches = matchRoutes(router.routes, '/app/me/credits')

  expect(matches?.map((match) => match.route.path)).toContain('me/credits')
  expect(matches?.at(-1)?.route.path).toBe('me/credits')
})

test('matches the public venue join page outside the protected app routes', () => {
  const matches = matchRoutes(router.routes, '/join/venue')

  expect(matches?.at(-1)?.route.path).toBe('/join/venue')
  expect(matches?.some((match) => match.route.path === '/app')).toBe(false)
})

test('matches the protected venue family members page before the app fallback route', () => {
  const matches = matchRoutes(router.routes, '/app/venues/home/members')

  expect(matches?.at(-1)?.route.path).toBe('venues/:venueId/members')
})
