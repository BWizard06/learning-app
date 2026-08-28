import { describe, expect, it } from 'vitest'
import {
  evaluatePromotion,
  roundHalfUp,
  weightedAverage,
  weightOf,
  type PartNotes,
} from './promotion'

const ALL_FOUR: PartNotes = {
  rechnen: 4,
  logik: 4,
  sprache: 4,
  wortfluss: 4,
  konzentration: 4,
  text: 4,
}

function withNotes(overrides: PartNotes): PartNotes {
  return { ...ALL_FOUR, ...overrides }
}

describe('roundHalfUp', () => {
  it('rounds a true half upwards, unlike Math.round on binary floats', () => {
    expect(roundHalfUp(3.745, 2)).toBe(3.75)
    expect(roundHalfUp(2.675, 2)).toBe(2.68)
    expect(roundHalfUp(1.005, 2)).toBe(1.01)
  })

  it('leaves exact values alone', () => {
    expect(roundHalfUp(4, 2)).toBe(4)
    expect(roundHalfUp(3.99, 2)).toBe(3.99)
  })
})

describe('weighting', () => {
  it('counts Textverständnis twice and everything else once', () => {
    expect(weightOf('text')).toBe(2)
    for (const c of ['rechnen', 'logik', 'sprache', 'wortfluss', 'konzentration'] as const) {
      expect(weightOf(c)).toBe(1)
    }
  })

  it('divides by seven, not six, because of the double weight', () => {
    expect(weightedAverage(withNotes({ text: 6 }))).toBe(roundHalfUp((4 * 5 + 6 * 2) / 7, 2))
  })

  it('is null without any part', () => {
    expect(weightedAverage({})).toBeNull()
  })

  it('averages only over the parts that exist', () => {
    expect(weightedAverage({ rechnen: 5, logik: 3 })).toBe(4)
  })
})

describe('the four ZHAW promotion rules, boundary table', () => {
  it('passes at exactly 4.00 with every part at 4.0', () => {
    const verdict = evaluatePromotion(ALL_FOUR)
    expect(verdict.average).toBe(4)
    expect(verdict.passed).toBe(true)
    expect(verdict.brokenRules).toEqual([])
  })

  it('fails at exactly 3.75 before rounding', () => {
    const notes = withNotes({ rechnen: 3, konzentration: 4, logik: 4 })
    const verdict = evaluatePromotion(notes)
    expect(verdict.average).toBe(roundHalfUp((3 + 4 + 4 + 4 + 4 + 4 * 2) / 7, 2))
    expect(verdict.average!).toBeLessThan(4)
    expect(verdict.passed).toBe(false)
    expect(verdict.brokenRules).toContain('durchschnitt')
  })

  it('passes with exactly one outlier at 3.0 in group B', () => {
    const verdict = evaluatePromotion(withNotes({ logik: 3, rechnen: 5, konzentration: 5, text: 4.5 }))
    expect(verdict.rules.find((r) => r.id === 'gruppe-b')!.passed).toBe(true)
    expect(verdict.rules.find((r) => r.id === 'gruppe-b-untergrenze')!.passed).toBe(true)
    expect(verdict.passed).toBe(true)
  })

  it('fails with one outlier at 2.5 in group B, even when the average carries', () => {
    const verdict = evaluatePromotion(
      withNotes({ logik: 2.5, rechnen: 6, konzentration: 6, wortfluss: 5, sprache: 5, text: 5 }),
    )
    expect(verdict.average!).toBeGreaterThanOrEqual(4)
    expect(verdict.rules.find((r) => r.id === 'durchschnitt')!.passed).toBe(true)
    expect(verdict.rules.find((r) => r.id === 'gruppe-b-untergrenze')!.passed).toBe(false)
    expect(verdict.passed).toBe(false)
    expect(verdict.brokenRules).toEqual(['gruppe-b-untergrenze'])
  })

  it('fails when both group A parts are under 4.0', () => {
    const verdict = evaluatePromotion(
      withNotes({ rechnen: 3.5, konzentration: 3.5, logik: 6, sprache: 6, wortfluss: 6, text: 6 }),
    )
    expect(verdict.rules.find((r) => r.id === 'gruppe-a')!.passed).toBe(false)
    expect(verdict.passed).toBe(false)
  })

  it('passes when exactly one group A part is under 4.0', () => {
    const verdict = evaluatePromotion(withNotes({ rechnen: 3.5, konzentration: 5, text: 4.5 }))
    expect(verdict.rules.find((r) => r.id === 'gruppe-a')!.passed).toBe(true)
    expect(verdict.passed).toBe(true)
  })

  it('fails when two group B parts are under 4.0', () => {
    const verdict = evaluatePromotion(
      withNotes({ logik: 3.5, wortfluss: 3.5, rechnen: 6, konzentration: 6, text: 5 }),
    )
    expect(verdict.rules.find((r) => r.id === 'gruppe-b')!.passed).toBe(false)
    expect(verdict.passed).toBe(false)
  })

  it('is the point of the whole exercise: one outlier sinks a good average', () => {
    const strong = evaluatePromotion(
      withNotes({ rechnen: 6, konzentration: 6, logik: 6, sprache: 6, wortfluss: 6, text: 2.9 }),
    )
    expect(strong.average!).toBeGreaterThan(5)
    expect(strong.passed).toBe(false)
    expect(strong.brokenRules).toContain('gruppe-b-untergrenze')
  })

  it('names every broken rule, not only the first', () => {
    const verdict = evaluatePromotion({
      rechnen: 2,
      konzentration: 2,
      logik: 2,
      sprache: 2,
      wortfluss: 2,
      text: 2,
    })
    expect(verdict.passed).toBe(false)
    expect(verdict.brokenRules).toEqual([
      'durchschnitt',
      'gruppe-a',
      'gruppe-b',
      'gruppe-b-untergrenze',
    ])
  })

  it('gives every rule a readable German label and a concrete detail', () => {
    const verdict = evaluatePromotion(withNotes({ logik: 2.5 }))
    for (const rule of verdict.rules) {
      expect(rule.label.length).toBeGreaterThan(10)
      expect(rule.detail.length).toBeGreaterThan(3)
      expect(rule.label).not.toContain('ß')
      expect(rule.detail).not.toContain('ß')
    }
  })
})

describe('incomplete runs', () => {
  it('marks a run incomplete and names the missing parts', () => {
    const verdict = evaluatePromotion({ rechnen: 5, logik: 5, wortfluss: 5, konzentration: 5 })
    expect(verdict.complete).toBe(false)
    expect(verdict.missingParts).toEqual(['sprache', 'text'])
    expect(verdict.missingLabels).toEqual(['Sprachliches Denken', 'Textverständnis'])
  })

  it('still evaluates the rules over the parts that exist', () => {
    const verdict = evaluatePromotion({ rechnen: 5, logik: 5, wortfluss: 5, konzentration: 5 })
    expect(verdict.average).toBe(5)
    expect(verdict.passed).toBe(true)
  })

  it('is complete when all six parts are present', () => {
    expect(evaluatePromotion(ALL_FOUR).complete).toBe(true)
    expect(evaluatePromotion(ALL_FOUR).missingParts).toEqual([])
  })
})

describe('exhaustive sweep', () => {
  it('never reports passed while a rule is broken, over every combination on a half note grid', () => {
    const grid = [2, 2.5, 3, 3.5, 4, 4.5, 5, 6]
    let checked = 0
    for (const rechnen of grid) {
      for (const konzentration of grid) {
        for (const logik of grid) {
          for (const text of grid) {
            const verdict = evaluatePromotion({
              rechnen,
              konzentration,
              logik,
              text,
              sprache: 4,
              wortfluss: 4,
            })
            checked++
            const anyBroken = verdict.rules.some((rule) => !rule.passed)
            expect(verdict.passed).toBe(!anyBroken)
            if (verdict.passed) {
              expect(verdict.average!).toBeGreaterThanOrEqual(4)
            }
          }
        }
      }
    }
    expect(checked).toBe(grid.length ** 4)
  })
})
