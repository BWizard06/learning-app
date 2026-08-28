export function movingAverage(values: readonly (number | null)[], window: number): (number | null)[] {
  if (window < 1) throw new RangeError('window must be at least 1')
  const result: (number | null)[] = []
  const buffer: number[] = []
  for (const value of values) {
    if (value !== null) {
      buffer.push(value)
      if (buffer.length > window) buffer.shift()
    }
    result.push(buffer.length === 0 ? null : buffer.reduce((sum, v) => sum + v, 0) / buffer.length)
  }
  return result
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export function isoWeek(date: string): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const target = new Date(Date.UTC(year, month - 1, day))
  const dayNumber = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNumber + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3)
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
