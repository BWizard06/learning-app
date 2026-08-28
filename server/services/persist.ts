import { and, asc, eq, gte } from 'drizzle-orm'
import { localDate } from '../../shared/dates'
import { buildPersonalNorm, computeNote, PERSONAL_NORM_WINDOW_DAYS } from '../../shared/scoring'
import type { Note, SessionPayload } from '../../shared/types'
import { gameBySlug } from '../../app/games/index'
import { sessions, trials } from '../db/schema'
import { recomputeDay } from './daylog'
import type { Db } from './types'

export interface SaveResult {
  created: boolean
  note: Note | null
}

const WINDOW_MS = PERSONAL_NORM_WINDOW_DAYS * 24 * 60 * 60 * 1000

export function saveSession(db: Db, payload: SessionPayload): SaveResult {
  const definition = gameBySlug(payload.gameSlug)
  if (!definition) throw new Error(`unknown game ${payload.gameSlug}`)

  return db.transaction((tx) => {
    const existing = tx
      .select({ id: sessions.id, note: sessions.note, noteSource: sessions.noteSource })
      .from(sessions)
      .where(eq(sessions.id, payload.id))
      .get()

    if (existing) {
      return {
        created: false,
        note:
          existing.note === null
            ? null
            : {
                value: existing.note,
                source: (existing.noteSource as Note['source']) ?? 'thresholds',
                sampleSize: 0,
              },
      }
    }

    const history = tx
      .select({ rawScore: sessions.rawScore })
      .from(sessions)
      .where(eq(sessions.gameSlug, payload.gameSlug))
      .orderBy(asc(sessions.startedAt))
      .all()
      .map((row) => row.rawScore)

    const window = tx
      .select({ rawScore: sessions.rawScore })
      .from(sessions)
      .where(
        and(
          eq(sessions.gameSlug, payload.gameSlug),
          gte(sessions.startedAt, payload.startedAt - WINDOW_MS),
        ),
      )
      .all()
      .map((row) => row.rawScore)

    const norm = buildPersonalNorm(history, window)
    const note = computeNote(payload.rawScore, definition.thresholds, norm)

    tx.insert(sessions)
      .values({
        id: payload.id,
        gameSlug: payload.gameSlug,
        startedAt: payload.startedAt,
        finishedAt: payload.finishedAt,
        durationMs: payload.durationMs,
        difficulty: payload.difficulty,
        rawScore: payload.rawScore,
        accuracy: payload.accuracy,
        note: note.value,
        noteSource: note.source,
        seed: payload.seed,
        mode: payload.mode,
        metricsJson: JSON.stringify(payload.metrics ?? {}),
        deviceId: payload.deviceId,
        syncedAt: Date.now(),
      })
      .onConflictDoNothing()
      .run()

    if (payload.trials.length > 0) {
      const rows = payload.trials.map((trial) => ({
        sessionId: payload.id,
        idx: trial.idx,
        itemType: trial.itemType,
        difficulty: trial.difficulty,
        itemJson: JSON.stringify(trial.params),
        responseJson: JSON.stringify(trial.response ?? null),
        correct: trial.correct,
        rtMs: trial.rtMs,
        presentedAt: trial.presentedAt,
      }))
      for (let i = 0; i < rows.length; i += 200) {
        tx.insert(trials).values(rows.slice(i, i + 200)).run()
      }
    }

    recomputeDay(tx as unknown as Db, localDate(payload.startedAt))

    return { created: true, note }
  })
}
