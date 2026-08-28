import { openDB, type IDBPDatabase } from 'idb'
import { classifyResponse, noteFromBody, type SyncVerdict } from '~~/shared/sync'
import type { Note, SessionPayload } from '~~/shared/types'

const DB_NAME = 'learning-app'
const DB_VERSION = 1
const STORE = 'outbox'

export interface OutboxEntry {
  id: string
  payload: SessionPayload
  queuedAt: number
  attempts: number
  lastError: string | null
}

let dbPromise: Promise<IDBPDatabase> | null = null

function database(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

export async function enqueue(payload: SessionPayload): Promise<void> {
  const db = await database()
  const existing = (await db.get(STORE, payload.id)) as OutboxEntry | undefined
  await db.put(STORE, {
    id: payload.id,
    payload,
    queuedAt: existing?.queuedAt ?? Date.now(),
    attempts: existing?.attempts ?? 0,
    lastError: existing?.lastError ?? null,
  } satisfies OutboxEntry)
}

export async function pending(): Promise<OutboxEntry[]> {
  const db = await database()
  const entries = (await db.getAll(STORE)) as OutboxEntry[]
  return entries.sort((a, b) => a.queuedAt - b.queuedAt)
}

export async function pendingCount(): Promise<number> {
  const db = await database()
  return db.count(STORE)
}

async function remove(id: string): Promise<void> {
  const db = await database()
  await db.delete(STORE, id)
}

async function markAttempt(entry: OutboxEntry, reason: string): Promise<void> {
  const db = await database()
  await db.put(STORE, { ...entry, attempts: entry.attempts + 1, lastError: reason })
}

export interface SendResult {
  verdict: SyncVerdict
  note: Note | null
  sessionId: string
}

export async function sendOne(entry: OutboxEntry): Promise<SendResult> {
  let verdict: SyncVerdict
  let note: Note | null = null

  try {
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(entry.payload),
    })

    const contentType = response.headers.get('content-type')
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      body = null
    }

    verdict = classifyResponse(
      { ok: response.ok, status: response.status, contentType },
      body,
      entry.id,
    )

    if (verdict.removeFromOutbox && verdict.outcome !== 'rejected') {
      note = noteFromBody(body) as Note | null
    }
  } catch (error) {
    verdict = {
      outcome: 'retry',
      removeFromOutbox: false,
      reason: error instanceof Error ? error.message : 'Netzwerkfehler',
    }
  }

  if (verdict.removeFromOutbox) await remove(entry.id)
  else await markAttempt(entry, verdict.reason)

  return { verdict, note, sessionId: entry.id }
}

export interface FlushResult {
  sent: number
  remaining: number
  unauthenticated: boolean
  lastError: string | null
  notes: Record<string, Note>
}

export async function flush(): Promise<FlushResult> {
  const entries = await pending()
  const notes: Record<string, Note> = {}
  let sent = 0
  let unauthenticated = false
  let lastError: string | null = null

  for (const entry of entries) {
    const result = await sendOne(entry)
    if (result.verdict.removeFromOutbox) {
      sent++
      if (result.note) notes[result.sessionId] = result.note
      continue
    }
    lastError = result.verdict.reason
    if (result.verdict.outcome === 'unauthenticated') unauthenticated = true
    break
  }

  return { sent, remaining: await pendingCount(), unauthenticated, lastError, notes }
}

export async function clearOutbox(): Promise<void> {
  const db = await database()
  await db.clear(STORE)
}
