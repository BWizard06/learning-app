import { linearWeight, weightedThroughput, accuracyOf, median } from '~~/shared/scoring'
import type { GameDefinition, RawScore, TrialResult } from '~~/shared/types'
import { generateWuerfel } from './generator'

const DIFFICULTY_RANGE: [number, number] = [1, 6]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 2.5)

function countOf(trials: TrialResult[], itemType: string, onlyCorrect: boolean): number {
  return trials.filter((trial) => trial.itemType === itemType && (!onlyCorrect || trial.correct)).length
}

const definition: GameDefinition = {
  slug: 'wuerfel',
  name: 'Würfel und Rotation',
  construct: 'logik',
  blurb: 'Netze im Kopf falten und Körper im Raum drehen, ohne Papier und ohne Modell.',
  mode: 'sprint',
  defaultDurationS: 180,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 0.8, raw4: 3.2, raw6: 7 },
  weight,
  generate: (difficulty, rng) => generateWuerfel(difficulty, rng),
  score(trials: TrialResult[], durationS: number): RawScore {
    const correct = trials.filter((trial) => trial.correct)
    return {
      raw: weightedThroughput(trials, durationS, weight),
      accuracy: accuracyOf(trials),
      metrics: {
        attempted: trials.length,
        correct: correct.length,
        medianRtMs: correct.length === 0 ? 0 : Math.round(median(correct.map((trial) => trial.rtMs))),
        netzGestellt: countOf(trials, 'netz', false),
        netzGeloest: countOf(trials, 'netz', true),
        rotationGestellt: countOf(trials, 'rotation', false),
        rotationGeloest: countOf(trials, 'rotation', true),
        meanDifficulty:
          trials.length === 0
            ? 0
            : Math.round((trials.reduce((sum, t) => sum + t.difficulty, 0) / trials.length) * 100) / 100,
      },
    }
  },
}

export default definition
