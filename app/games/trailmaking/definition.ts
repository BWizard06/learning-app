import { linearWeight, median, weightedThroughput } from '~~/shared/scoring'
import type { GameDefinition, RawScore, TrialResult } from '~~/shared/types'
import { PART_A, PART_B, generateTrailBlock, idsFrom, orderFromParams, walkTaps } from './generator'

const DIFFICULTY_RANGE: [number, number] = [1, 5]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 2)

const definition: GameDefinition = {
  slug: 'trailmaking',
  name: 'Zahlenpfad',
  construct: 'konzentration',
  blurb: 'Kreise in der richtigen Reihenfolge verbinden, zuerst nur Zahlen, dann Zahl und Buchstabe im Wechsel.',
  mode: 'block',
  defaultDurationS: 180,
  itemCount: 4,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 0.4, raw4: 1.6, raw6: 3.2 },
  scoresCorrectness: false,
  weight,
  generate: (difficulty, rng) => generateTrailBlock(difficulty, rng),
  isCorrect(trial, response) {
    const expected = idsFrom(trial.answer)
    if (expected.length === 0) return false
    return walkTaps(expected, idsFrom(response)).visited === expected.length
  },
  score(trials: TrialResult[], durationS: number): RawScore {
    const timesA: number[] = []
    const timesB: number[] = []
    let fehler = 0
    let knoten = 0

    for (const trial of trials) {
      const walk = walkTaps(orderFromParams(trial.params), idsFrom(trial.response))
      fehler += walk.errors
      knoten += walk.visited
      if (trial.itemType === PART_A) timesA.push(trial.rtMs)
      else if (trial.itemType === PART_B) timesB.push(trial.rtMs)
    }

    const teilAMs = timesA.length === 0 ? 0 : Math.round(median(timesA))
    const teilBMs = timesB.length === 0 ? 0 : Math.round(median(timesB))
    const taps = knoten + fehler

    return {
      raw: weightedThroughput(trials, durationS, weight),
      accuracy: taps === 0 ? 0 : knoten / taps,
      metrics: {
        fehler,
        teilAMs,
        teilBMs,
        differenzMs: timesA.length === 0 || timesB.length === 0 ? 0 : teilBMs - teilAMs,
        knoten,
      },
    }
  },
}

export default definition
