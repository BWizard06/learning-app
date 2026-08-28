import { linearWeight, weightedThroughput, accuracyOf, median } from '~~/shared/scoring'
import type { GameDefinition, RawScore, TrialResult } from '~~/shared/types'
import { generateMatrix } from './generator'

const DIFFICULTY_RANGE: [number, number] = [1, 10]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 3)

const definition: GameDefinition = {
  slug: 'matrizen',
  name: 'Matrizen',
  construct: 'logik',
  blurb: 'Regeln in Zeilen und Spalten erkennen und die fehlende Figur bestimmen.',
  mode: 'sprint',
  defaultDurationS: 180,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 0.8, raw4: 3.5, raw6: 8 },
  weight,
  generate: (difficulty, rng) => generateMatrix(difficulty, rng),
  score(trials: TrialResult[], durationS: number): RawScore {
    const correct = trials.filter((trial) => trial.correct)
    return {
      raw: weightedThroughput(trials, durationS, weight),
      accuracy: accuracyOf(trials),
      metrics: {
        attempted: trials.length,
        correct: correct.length,
        medianRtMs: correct.length === 0 ? 0 : Math.round(median(correct.map((trial) => trial.rtMs))),
        meanDifficulty:
          trials.length === 0
            ? 0
            : Math.round((trials.reduce((sum, t) => sum + t.difficulty, 0) / trials.length) * 100) / 100,
      },
    }
  },
}

export default definition
