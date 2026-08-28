import { and, desc, eq, gte } from 'drizzle-orm'
import { useDb } from '../db/client'
import { sessions } from '../db/schema'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const limit = Math.min(500, Math.max(1, Number.parseInt(String(query.limit ?? '50'), 10) || 50))
  const slug = typeof query.game === 'string' ? query.game : null
  const since = Number.parseInt(String(query.since ?? ''), 10)

  const filters = [
    slug ? eq(sessions.gameSlug, slug) : undefined,
    Number.isFinite(since) ? gte(sessions.startedAt, since) : undefined,
  ].filter(Boolean)

  const rows = useDb()
    .select()
    .from(sessions)
    .where(filters.length ? and(...(filters as [])) : undefined)
    .orderBy(desc(sessions.startedAt))
    .limit(limit)
    .all()

  return rows.map((row) => ({ ...row, metrics: JSON.parse(row.metricsJson) as Record<string, number> }))
})
