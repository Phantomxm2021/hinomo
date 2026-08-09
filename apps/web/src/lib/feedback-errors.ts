export type FeedbackErrorClassification = {
  titleKey: 'common.operationFailed'
  messageKey: string
  retryable: boolean
}

const knownMessages: Record<string, Omit<FeedbackErrorClassification, 'titleKey'>> = {
  venue_member_limit_reached: { messageKey: 'venueSharing.memberLimitReached', retryable: false },
  venue_invite_expired: { messageKey: 'venueSharing.inviteExpired', retryable: false },
  venue_invite_revoked: { messageKey: 'venueSharing.inviteRevoked', retryable: false },
  venue_invite_not_found: { messageKey: 'venueSharing.inviteNotFound', retryable: false },
  '42501': { messageKey: 'common.permissionDenied', retryable: false },
}

function collectText(value: unknown, seen = new Set<object>()): string[] {
  if (typeof value === 'string') return [value]
  if (!value || typeof value !== 'object') return []
  if (seen.has(value)) return []
  seen.add(value)

  const record = value as Record<string, unknown>
  return ['code', 'message', 'details', 'cause'].flatMap((key) => collectText(record[key], seen))
}

export function classifyFeedbackError(error: unknown): FeedbackErrorClassification {
  const values = collectText(error)
  const known = values.map((value) => knownMessages[value]).find(Boolean)
  if (known) return { titleKey: 'common.operationFailed', ...known }
  if (values.some((value) => /failed to fetch|networkerror|network request failed/i.test(value))) {
    return { titleKey: 'common.operationFailed', messageKey: 'common.networkError', retryable: true }
  }
  return { titleKey: 'common.operationFailed', messageKey: 'common.operationError', retryable: false }
}
