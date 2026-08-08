import { expect, test } from 'vitest'
import { greetingForHour } from './dashboard-greeting'

test.each([
  [5, 'morning'],
  [10, 'morning'],
  [11, 'noon'],
  [13, 'noon'],
  [14, 'afternoon'],
  [17, 'afternoon'],
  [18, 'evening'],
  [0, 'evening'],
] as const)('returns a stable greeting key for hour %i', (hour, expected) => {
  expect(greetingForHour(hour)).toBe(expected)
})
