import { and, eq, gte, lt } from 'drizzle-orm'
import { localDate, localDayBounds } from '../../shared/dates'
import { dayLog, sessions } from '../db/schema'
import type { Db } from './types'

export function recomputeDay(db: Db, date: string): void {
  const [start, end] = localDayBounds(date)
  const rows = db
    .select({
      gameSlug: sessions.gameSlug,
      durationMs: sessions.durationMs,
      note: sessions.note,
    })
    .from(sessions)
    .where(and(gte(sessions.startedAt, start), lt(sessions.startedAt, end)))
    .all()

  if (rows.length === 0) {
    db.delete(dayLog).where(eq(dayLog.date, date)).run()
    return
  }

  const notes = rows.map((row) => row.note).filter((note): note is number => note !== null)
  const minutes = rows.reduce((sum, row) => sum + row.durationMs, 0) / 60000

  const constructs: Record<string, number> = {}
  for (const row of rows) {
    constructs[row.gameSlug] = (constructs[row.gameSlug] ?? 0) + 1
  }

  const values = {
    date,
    sessionsCount: rows.length,
    minutes: Math.round(minutes * 100) / 100,
    meanNote: notes.length ? Math.round((notes.reduce((s, n) => s + n, 0) / notes.length) * 100) / 100 : null,
    constructsJson: JSON.stringify(constructs),
  }

  db.insert(dayLog)
    .values(values)
    .onConflictDoUpdate({ target: dayLog.date, set: values })
    .run()
}

export function rebuildDayLog(db: Db): number {
  const rows = db.select({ startedAt: sessions.startedAt }).from(sessions).all()
  const dates = new Set(rows.map((row) => localDate(row.startedAt)))
  db.delete(dayLog).run()
  for (const date of dates) recomputeDay(db, date)
  return dates.size
}
