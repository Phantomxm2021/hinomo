import { expect, test } from 'vitest'
import { safeReturnTo } from './safe-return-to'

test('rejects a backslash-prefixed authority escape', () => {
  expect(safeReturnTo('/\\evil.test/steal-session')).toBe('/app')
})
