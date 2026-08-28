export function toPlainPayload<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export type SyncOutcome = 'stored' | 'duplicate' | 'rejected' | 'unauthenticated' | 'retry'

export interface SyncVerdict {
  outcome: SyncOutcome
  removeFromOutbox: boolean
  reason: string
}

export function noteFromBody(body: unknown): { value: number; source: string; sampleSize: number } | null {
  if (typeof body !== 'object' || body === null) return null
  const note = (body as { note?: unknown }).note
  if (typeof note !== 'object' || note === null) return null
  const record = note as Record<string, unknown>
  if (typeof record.value !== 'number' || typeof record.source !== 'string') return null
  return {
    value: record.value,
    source: record.source,
    sampleSize: typeof record.sampleSize === 'number' ? record.sampleSize : 0,
  }
}

export interface ResponseLike {
  ok: boolean
  status: number
  contentType: string | null
}

export function looksLikeJson(contentType: string | null): boolean {
  if (!contentType) return false
  return contentType.split(';')[0]!.trim().toLowerCase() === 'application/json'
}

export function isExpectedBody(body: unknown, expectedId: string): boolean {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
  const record = body as Record<string, unknown>
  return record.id === expectedId && typeof record.created === 'boolean'
}

export function classifyResponse(
  response: ResponseLike,
  body: unknown,
  expectedId: string,
): SyncVerdict {
  if (response.status === 401 || response.status === 403) {
    return {
      outcome: 'unauthenticated',
      removeFromOutbox: false,
      reason: 'Sitzung abgelaufen',
    }
  }

  if (!looksLikeJson(response.contentType)) {
    return {
      outcome: 'unauthenticated',
      removeFromOutbox: false,
      reason: 'Antwort war kein JSON, vermutlich die Anmeldeseite',
    }
  }

  if (response.status >= 500) {
    return { outcome: 'retry', removeFromOutbox: false, reason: `Serverfehler ${response.status}` }
  }

  if (response.status === 400 || response.status === 422) {
    return {
      outcome: 'rejected',
      removeFromOutbox: true,
      reason: 'Server hat den Durchgang abgelehnt',
    }
  }

  if (!response.ok) {
    return { outcome: 'retry', removeFromOutbox: false, reason: `Status ${response.status}` }
  }

  if (!isExpectedBody(body, expectedId)) {
    return {
      outcome: 'retry',
      removeFromOutbox: false,
      reason: 'Antwort passte nicht zum gesendeten Durchgang',
    }
  }

  const created = (body as { created: boolean }).created
  return {
    outcome: created ? 'stored' : 'duplicate',
    removeFromOutbox: true,
    reason: created ? 'gespeichert' : 'war bereits gespeichert',
  }
}
