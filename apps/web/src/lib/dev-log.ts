export function serializeDevLogError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
    }
  }
  if (error && typeof error === 'object') {
    return Object.fromEntries(
      Object.entries(error).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value)),
    )
  }
  return { value: String(error) }
}

export function reportDevLog(event: string, details: Record<string, unknown>) {
  if (!import.meta.env.DEV) return
  const payload = {
    event,
    page: typeof window === 'undefined' ? undefined : window.location.href,
    ...details,
  }
  void fetch('/__nomo/dev-log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined)
}
