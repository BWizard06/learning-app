import { useDb } from '../db/client'
import { writeSetting } from '../services/settings'

const MAX_KEY = 80
const MAX_VALUE = 2000

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (typeof body !== 'object' || body === null) {
    throw createError({ statusCode: 400, statusMessage: 'expected an object' })
  }

  const entries = Object.entries(body as Record<string, unknown>)
  for (const [key, value] of entries) {
    if (key.length === 0 || key.length > MAX_KEY) {
      throw createError({ statusCode: 400, statusMessage: `invalid key ${key.slice(0, 20)}` })
    }
    if (typeof value !== 'string' || value.length > MAX_VALUE) {
      throw createError({ statusCode: 400, statusMessage: `invalid value for ${key}` })
    }
  }

  const db = useDb()
  for (const [key, value] of entries) writeSetting(db, key, value as string)
  return { written: entries.length }
})
