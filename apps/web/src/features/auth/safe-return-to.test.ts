import { expect, test } from 'vitest'
import { safeReturnTo } from './safe-return-to'

test('rejects a backslash-prefixed authority escape', () => {
  expect(safeReturnTo('/\\evil.test/steal-session')).toBe('/app')
})

test.each(['/\t/evil.test', '/\n/evil.test', '/\r/evil.test'])(
  'rejects a control-character authority escape: %j',
  (value) => {
    expect(safeReturnTo(value)).toBe('/app')
  },
)

test('keeps an encoded backslash as an app-relative path', () => {
  expect(safeReturnTo('/%5Cevil.test')).toBe('/%5Cevil.test')
})
