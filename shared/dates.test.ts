import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, localDate, localDayBounds, localHour, localMidnight, DAY_MS } from './dates'

describe('local date handling in Europe/Zurich', () => {
  it('maps a UTC instant to the Swiss calendar day', () => {
    expect(localDate(Date.UTC(2026, 5, 15, 12, 0))).toBe('2026-06-15')
  })

  it('rolls the day over at Swiss midnight, not UTC midnight', () => {
    expect(localDate(Date.UTC(2026, 5, 15, 22, 30))).toBe('2026-06-16')
    expect(localDate(Date.UTC(2026, 0, 15, 23, 30))).toBe('2026-01-16')
  })

  it('places midnight correctly in winter and summer', () => {
    expect(localMidnight('2026-01-15')).toBe(Date.UTC(2026, 0, 14, 23, 0))
    expect(localMidnight('2026-06-15')).toBe(Date.UTC(2026, 5, 14, 22, 0))
  })

  it('handles the spring forward day as twenty three hours', () => {
    const [start, end] = localDayBounds('2026-03-29')
    expect(end - start).toBe(23 * 60 * 60 * 1000)
  })

  it('handles the autumn fall back day as twenty five hours', () => {
    const [start, end] = localDayBounds('2026-10-25')
    expect(end - start).toBe(25 * 60 * 60 * 1000)
  })

  it('gives every ordinary day exactly twenty four hours', () => {
    for (const date of ['2026-01-15', '2026-06-15', '2026-12-01']) {
      const [start, end] = localDayBounds(date)
      expect(end - start).toBe(DAY_MS)
    }
  })

  it('covers the whole day without gaps or overlaps across a DST boundary', () => {
    const before = localDayBounds('2026-10-24')
    const during = localDayBounds('2026-10-25')
    const after = localDayBounds('2026-10-26')
    expect(before[1]).toBe(during[0])
    expect(during[1]).toBe(after[0])
  })

  it('reports the local hour, which is what the 17:30 exam analysis needs', () => {
    expect(localHour(Date.UTC(2026, 5, 15, 15, 30))).toBe(17)
    expect(localHour(Date.UTC(2026, 0, 15, 16, 30))).toBe(17)
  })

  it('adds days across the spring transition', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
  })

  it('counts days across both transitions', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
    expect(daysBetween('2026-01-01', '2026-12-31')).toBe(364)
  })

  it('round trips every day of a year', () => {
    let date = '2026-01-01'
    for (let i = 0; i < 365; i++) {
      const [start, end] = localDayBounds(date)
      expect(localDate(start)).toBe(date)
      expect(localDate(end - 1)).toBe(date)
      date = addDays(date, 1)
    }
    expect(date).toBe('2027-01-01')
  })
})
