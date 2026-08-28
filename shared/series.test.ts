import { describe, expect, it } from 'vitest'
import { isoWeek, mean, movingAverage, round } from './series'

describe('movingAverage', () => {
  it('smooths a rising series', () => {
    expect(movingAverage([1, 2, 3, 4], 2)).toEqual([1, 1.5, 2.5, 3.5])
  })

  it('carries the last known values across a gap', () => {
    expect(movingAverage([2, null, 4], 2)).toEqual([2, 2, 3])
  })

  it('returns null until the first value arrives', () => {
    expect(movingAverage([null, null, 5], 3)).toEqual([null, null, 5])
  })

  it('rejects a window below one', () => {
    expect(() => movingAverage([1], 0)).toThrow()
  })
})

describe('mean', () => {
  it('is null for an empty list', () => {
    expect(mean([])).toBeNull()
  })

  it('averages', () => {
    expect(mean([2, 4, 6])).toBe(4)
  })
})

describe('isoWeek', () => {
  it('assigns the ISO week', () => {
    expect(isoWeek('2026-01-01')).toBe('2026-W01')
    expect(isoWeek('2026-06-15')).toBe('2026-W25')
  })

  it('puts the first days of January into the previous year when ISO says so', () => {
    expect(isoWeek('2027-01-01')).toBe('2026-W53')
  })

  it('keeps a whole week under one label', () => {
    const labels = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21']
      .map(isoWeek)
    expect(new Set(labels).size).toBe(1)
  })
})

describe('round', () => {
  it('rounds to the given digits', () => {
    expect(round(1.23456, 2)).toBe(1.23)
    expect(round(1.2371, 2)).toBe(1.24)
  })

  it('inherits binary floating point behaviour at exact halves', () => {
    expect(round(1.005, 2)).toBe(1)
    expect(round(2.675, 2)).toBe(2.68)
  })

  it('is display rounding only, never promotion rounding', () => {
    expect(round(3.745, 2)).toBe(3.75)
    expect(round(3.7449, 1)).toBe(3.7)
  })
})
