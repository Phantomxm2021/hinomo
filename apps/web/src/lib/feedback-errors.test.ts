import { expect, test } from 'vitest'
import { classifyFeedbackError } from './feedback-errors'

test('maps known venue capacity codes without exposing backend text', () => {
  expect(classifyFeedbackError({ code: 'venue_member_limit_reached', message: 'raw postgres message' })).toEqual({
    titleKey: 'common.operationFailed',
    messageKey: 'venueSharing.memberLimitReached',
    retryable: false,
  })
})

test('walks nested Supabase causes to classify an expired invitation', () => {
  expect(classifyFeedbackError({ cause: { message: 'venue_invite_expired' } })).toEqual({
    titleKey: 'common.operationFailed',
    messageKey: 'venueSharing.inviteExpired',
    retryable: false,
  })
})

test('maps the actual missing invitation domain code', () => {
  expect(classifyFeedbackError({ code: 'venue_invite_missing' })).toEqual({
    titleKey: 'common.operationFailed',
    messageKey: 'venueSharing.inviteNotFound',
    retryable: false,
  })
})

test('normalizes permission, network, and unknown errors to stable message keys', () => {
  expect(classifyFeedbackError({ code: '42501' })).toEqual({
    titleKey: 'common.operationFailed',
    messageKey: 'common.permissionDenied',
    retryable: false,
  })
  expect(classifyFeedbackError(new TypeError('Failed to fetch'))).toEqual({
    titleKey: 'common.operationFailed',
    messageKey: 'common.networkError',
    retryable: true,
  })
  expect(classifyFeedbackError(new Error('Unexpected database payload'))).toEqual({
    titleKey: 'common.operationFailed',
    messageKey: 'common.operationError',
    retryable: false,
  })
})
