import { describe, expect, it } from 'vitest'
import { buildExamParts, isRecommendedStartTime, startTimeNote, PREFERRED_EXAM_GAMES } from './exam'
import { EXAM_CONSTRUCTS } from './types'

describe('buildExamParts', () => {
  it('keeps the exam order regardless of which games exist', () => {
    const { parts } = buildExamParts(['wortfluss', 'kopfrechnen', 'd2', 'zahlenreihen'])
    expect(parts.map((p) => p.construct)).toEqual(['rechnen', 'logik', 'wortfluss', 'konzentration'])
  })

  it('names the constructs that have no game at all', () => {
    const { missing } = buildExamParts(['kopfrechnen', 'zahlenreihen', 'wortfluss', 'd2'])
    expect(missing).toEqual(['sprache', 'text'])
  })

  it('takes the first preference that is available', () => {
    const { parts } = buildExamParts(['ueberschlag', 'matrizen'])
    expect(parts.find((p) => p.construct === 'rechnen')!.slug).toBe('ueberschlag')
    expect(parts.find((p) => p.construct === 'logik')!.slug).toBe('matrizen')
  })

  it('prefers the exam nearest game when several are available', () => {
    const { parts } = buildExamParts(['ueberschlag', 'kopfrechnen', 'matrizen', 'zahlenreihen'])
    expect(parts.find((p) => p.construct === 'rechnen')!.slug).toBe('kopfrechnen')
    expect(parts.find((p) => p.construct === 'logik')!.slug).toBe('zahlenreihen')
  })

  it('returns nothing usable when no game exists', () => {
    const { parts, missing } = buildExamParts([])
    expect(parts).toEqual([])
    expect(missing).toEqual([...EXAM_CONSTRUCTS])
  })

  it('never puts a memory game into the exam, it is not an exam part', () => {
    const { parts } = buildExamParts(['nback', 'corsi', 'kopfrechnen'])
    expect(parts.map((p) => p.slug)).not.toContain('nback')
    expect(parts.map((p) => p.slug)).not.toContain('corsi')
  })

  it('lists a preference for every exam construct', () => {
    for (const construct of EXAM_CONSTRUCTS) {
      expect(PREFERRED_EXAM_GAMES[construct].length).toBeGreaterThan(0)
    }
  })
})

describe('start time', () => {
  it('accepts 17:30 and later', () => {
    expect(isRecommendedStartTime(17, 30)).toBe(true)
    expect(isRecommendedStartTime(19, 0)).toBe(true)
    expect(isRecommendedStartTime(23, 59)).toBe(true)
  })

  it('rejects anything before 17:30', () => {
    expect(isRecommendedStartTime(17, 29)).toBe(false)
    expect(isRecommendedStartTime(9, 0)).toBe(false)
  })

  it('explains itself in German without a sharp s', () => {
    const early = startTimeNote(9, 15)
    const late = startTimeNote(18, 0)
    expect(early).toContain('17:30')
    expect(late).toContain('18:00')
    expect(early).not.toContain('ß')
    expect(late).not.toContain('ß')
  })
})
