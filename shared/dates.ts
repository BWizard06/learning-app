export const APP_TIME_ZONE = 'Europe/Zurich'
export const DAY_MS = 24 * 60 * 60 * 1000

const isoFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

export function localDate(epochMs: number): string {
  return isoFormatter.format(new Date(epochMs))
}

function zoneOffsetMs(epochMs: number): number {
  const parts = partsFormatter.formatToParts(new Date(epochMs))
  const read = (type: string) => Number(parts.find((part) => part.type === type)!.value)
  const asUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour') % 24,
    read('minute'),
    read('second'),
  )
  return asUtc - epochMs
}

export function localMidnight(date: string): number {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0)
  const firstPass = guess - zoneOffsetMs(guess)
  return guess - zoneOffsetMs(firstPass)
}

export function localDayBounds(date: string): [number, number] {
  const start = localMidnight(date)
  const nextDate = localDate(start + DAY_MS + 6 * 60 * 60 * 1000)
  return [start, localMidnight(nextDate)]
}

export function localHour(epochMs: number): number {
  const parts = partsFormatter.formatToParts(new Date(epochMs))
  return Number(parts.find((part) => part.type === 'hour')!.value) % 24
}

export function addDays(date: string, days: number): string {
  return localDate(localMidnight(date) + days * DAY_MS + 6 * 60 * 60 * 1000)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((localMidnight(to) - localMidnight(from)) / DAY_MS)
}

export function today(now = Date.now()): string {
  return localDate(now)
}
