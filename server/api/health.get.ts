import { sql } from 'drizzle-orm'
import { useDb } from '../db/client'

export default defineEventHandler(() => {
  const db = useDb()
  db.get(sql`SELECT 1`)
  return { status: 'ok', time: new Date().toISOString() }
})
