import { describe, expect, it } from 'vitest'
import { currentStreak, longestStreak } from './streak'

const now = Date.UTC(2026, 5, 15, 12, 0)

describe('currentStreak', () => {
  it('is zero without any training days', () => {
    expect(currentStreak([], now)).toBe(0)
  })

  it('counts an unbroken run ending today', () => {
    expect(currentStreak(['2026-06-15', '2026-06-14', '2026-06-13'], now)).toBe(3)
  })

  it('survives a day that is not finished yet', () => {
    expect(currentStreak(['2026-06-14', '2026-06-13'], now)).toBe(2)
  })

  it('breaks after two missed days', () => {
    expect(currentStreak(['2026-06-13', '2026-06-12'], now)).toBe(0)
  })

  it('ignores gaps further back', () => {
    expect(currentStreak(['2026-06-15', '2026-06-14', '2026-06-10'], now)).toBe(2)
  })

  it('counts across the spring time change', () => {
    const march = Date.UTC(2026, 2, 30, 12, 0)
    expect(currentStreak(['2026-03-30', '2026-03-29', '2026-03-28'], march)).toBe(3)
  })
})

describe('longestStreak', () => {
  it('finds the longest historical run', () => {
    const dates = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-10', '2026-06-11']
    expect(longestStreak(dates)).toBe(3)
  })

  it('handles a single day', () => {
    expect(longestStreak(['2026-06-01'])).toBe(1)
  })

  it('handles no days', () => {
    expect(longestStreak([])).toBe(0)
  })
})
