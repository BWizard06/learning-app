import { useDb } from '../db/client'
import { buildStats } from '../services/stats'

export default defineEventHandler(() => buildStats(useDb()))
