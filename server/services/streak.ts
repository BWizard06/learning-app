import { desc } from 'drizzle-orm'
import { addDays, today } from '../../shared/dates'
import { dayLog } from '../db/schema'
import type { Db } from './types'

export function activeDates(db: Db): string[] {
  return db
    .select({ date: dayLog.date })
    .from(dayLog)
    .orderBy(desc(dayLog.date))
    .all()
    .map((row) => row.date)
}

export function currentStreak(dates: readonly string[], now = Date.now()): number {
  if (dates.length === 0) return 0
  const set = new Set(dates)
  const currentDay = today(now)
  let cursor = set.has(currentDay) ? currentDay : addDays(currentDay, -1)
  if (!set.has(cursor)) return 0

  let streak = 0
  while (set.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function longestStreak(dates: readonly string[]): number {
  if (dates.length === 0) return 0
  const sorted = [...new Set(dates)].sort()
  let best = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    const previous = addDays(sorted[i]!, -1)
    if (previous === sorted[i - 1]) {
      run++
      best = Math.max(best, run)
    } else {
      run = 1
    }
  }
  return best
}
