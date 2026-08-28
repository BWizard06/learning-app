import { desc } from 'drizzle-orm'
import { useDb } from '../db/client'
import { examRuns } from '../db/schema'

export default defineEventHandler(() =>
  useDb()
    .select()
    .from(examRuns)
    .orderBy(desc(examRuns.startedAt))
    .limit(50)
    .all()
    .map((row) => ({
      ...row,
      partNotes: JSON.parse(row.partNotesJson) as Record<string, number>,
      verdict: JSON.parse(row.verdictJson) as unknown,
    })),
)
