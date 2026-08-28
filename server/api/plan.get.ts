import { today } from '../../shared/dates'
import { useDb } from '../db/client'
import { buildPlan } from '../services/plan'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const date = typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : today()
  return buildPlan(useDb(), date)
})
