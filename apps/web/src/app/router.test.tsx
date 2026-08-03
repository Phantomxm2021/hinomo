import { matchRoutes } from 'react-router-dom'
import { expect, test } from 'vitest'
import { router } from './router'

test('matches the AI credit store before the app fallback route', () => {
  const matches = matchRoutes(router.routes, '/app/me/credits')

  expect(matches?.map((match) => match.route.path)).toContain('me/credits')
  expect(matches?.at(-1)?.route.path).toBe('me/credits')
})
