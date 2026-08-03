import { expect, test } from 'vitest'
import {
  SYSTEM_ACTION_SHEET_Z_INDEX,
  SYSTEM_ALERT_Z_INDEX,
  SYSTEM_DIALOG_Z_INDEX,
  SYSTEM_NOTICE_Z_INDEX,
} from './overlay-layers'

test('keeps system feedback above every business sheet in a fixed order', () => {
  expect(SYSTEM_ALERT_Z_INDEX).toBeGreaterThan(SYSTEM_NOTICE_Z_INDEX)
  expect(SYSTEM_NOTICE_Z_INDEX).toBeGreaterThan(SYSTEM_ACTION_SHEET_Z_INDEX)
  expect(SYSTEM_ACTION_SHEET_Z_INDEX).toBeGreaterThan(SYSTEM_DIALOG_Z_INDEX)
  expect(SYSTEM_DIALOG_Z_INDEX).toBeGreaterThan(1_000)
})
