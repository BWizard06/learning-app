import { today } from '../../shared/dates'
import { gameBySlug } from '../../app/games/index'
import { useDb } from '../db/client'
import { markPlanCompleted } from '../services/plan'

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { slug?: unknown; date?: unknown }
  const slug = typeof body?.slug === 'string' ? body.slug : null
  if (!slug || !gameBySlug(slug)) {
    throw createError({ statusCode: 400, statusMessage: 'unknown game' })
  }
  const date =
    typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : today()
  return { completed: markPlanCompleted(useDb(), date, slug) }
})
