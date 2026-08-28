import { linearWeight, weightedThroughput, accuracyOf } from '~~/shared/scoring'
import type { GameDefinition, RawScore, TrialResult } from '~~/shared/types'
import { generateSequence } from './generator'

const DIFFICULTY_RANGE: [number, number] = [1, 12]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 3.2)

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = values.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

const definition: GameDefinition = {
  slug: 'zahlenreihen',
  name: 'Zahlenreihen',
  construct: 'logik',
  blurb: 'Bildungsgesetze erkennen und die Reihe fortsetzen.',
  mode: 'sprint',
  defaultDurationS: 120,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 1.5, raw4: 7, raw6: 16 },
  weight,
  generate: (difficulty, rng) => generateSequence(difficulty, rng),
  score(trials: TrialResult[], durationS: number): RawScore {
    const correct = trials.filter((trial) => trial.correct)
    return {
      raw: weightedThroughput(trials, durationS, weight),
      accuracy: accuracyOf(trials),
      metrics: {
        attempted: trials.length,
        correct: correct.length,
        medianRtMs: Math.round(median(correct.map((trial) => trial.rtMs))),
        meanDifficulty:
          trials.length === 0
            ? 0
            : Math.round((trials.reduce((sum, t) => sum + t.difficulty, 0) / trials.length) * 100) /
              100,
      },
    }
  },
}

export default definition
