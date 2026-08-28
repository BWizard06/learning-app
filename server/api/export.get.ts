import { asc } from 'drizzle-orm'
import { useDb } from '../db/client'
import { dayLog, examRuns, sessions, settings, trials } from '../db/schema'

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const columns = Object.keys(rows[0]!)
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return ''
    const text = String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [columns.join(','), ...rows.map((row) => columns.map((c) => escape(row[c])).join(','))].join('\n')
}

export default defineEventHandler((event) => {
  const db = useDb()
  const format = String(getQuery(event).format ?? 'json')

  const allSessions = db.select().from(sessions).orderBy(asc(sessions.startedAt)).all()
  const allTrials = db.select().from(trials).orderBy(asc(trials.id)).all()

  if (format === 'csv') {
    const target = String(getQuery(event).table ?? 'sessions')
    const rows = target === 'trials' ? allTrials : allSessions
    setHeader(event, 'content-type', 'text/csv; charset=utf-8')
    setHeader(event, 'content-disposition', `attachment; filename="${target}.csv"`)
    return toCsv(rows as unknown as Record<string, unknown>[])
  }

  setHeader(event, 'content-disposition', 'attachment; filename="learning-app-export.json"')
  return {
    exportedAt: new Date().toISOString(),
    sessions: allSessions,
    trials: allTrials,
    dayLog: db.select().from(dayLog).orderBy(asc(dayLog.date)).all(),
    settings: db.select().from(settings).all(),
    examRuns: db.select().from(examRuns).all(),
  }
})
