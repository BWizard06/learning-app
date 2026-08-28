import { useDb } from '../db/client'
import { readAllDifficulties, readAllSettings } from '../services/settings'

export default defineEventHandler(() => {
  const db = useDb()
  return { settings: readAllSettings(db), difficulties: readAllDifficulties(db) }
})
