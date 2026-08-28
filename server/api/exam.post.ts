import { useDb } from '../db/client'
import { examRuns } from '../db/schema'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Record<string, unknown>

  const id = typeof body?.id === 'string' && UUID.test(body.id) ? body.id : null
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id must be a uuid' })

  const startedAt = Number(body.startedAt)
  const finishedAt = Number(body.finishedAt)
  const seed = Number(body.seed)
  if (!Number.isInteger(startedAt) || !Number.isInteger(finishedAt) || !Number.isInteger(seed)) {
    throw createError({ statusCode: 400, statusMessage: 'startedAt, finishedAt and seed must be integers' })
  }

  const db = useDb()
  db.insert(examRuns)
    .values({
      id,
      startedAt,
      finishedAt,
      partNotesJson: JSON.stringify(body.partNotes ?? {}),
      passed: body.passed === true,
      verdictJson: JSON.stringify(body.verdict ?? {}),
      seed,
      repeatedSeed: body.repeatedSeed === true,
    })
    .onConflictDoNothing()
    .run()

  return { id, stored: true }
})
