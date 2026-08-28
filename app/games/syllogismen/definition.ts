import { accuracyOf, linearWeight, median, weightedThroughput } from '~~/shared/scoring'
import type { GameDefinition, RawScore, TrialResult } from '~~/shared/types'
import { generateSyllogism, trapFromParams, verdictFromParams } from './generator'

const DIFFICULTY_RANGE: [number, number] = [1, 6]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 2.2)

function medianMs(values: number[]): number {
  return values.length === 0 ? 0 : Math.round(median(values))
}

function hits(trials: TrialResult[]): number {
  return trials.filter((trial) => trial.correct).length
}

const definition: GameDefinition = {
  slug: 'syllogismen',
  name: 'Schlussfolgerungen',
  construct: 'logik',
  blurb: 'Zwei Aussagen, ein Schluss. Folgt er zwingend, folgt er nicht, oder widerspricht er?',
  mode: 'sprint',
  defaultDurationS: 180,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 1, raw4: 4.5, raw6: 9 },
  weight,
  generate: (difficulty, rng) => generateSyllogism(difficulty, rng),
  score(trials: TrialResult[], durationS: number): RawScore {
    const correct = trials.filter((trial) => trial.correct)
    const gueltig = trials.filter((trial) => verdictFromParams(trial.params) === 'folgt')
    const widerspruch = trials.filter((trial) => verdictFromParams(trial.params) === 'widerspricht')
    const fallen = trials.filter((trial) => trapFromParams(trial.params))

    return {
      raw: weightedThroughput(trials, durationS, weight),
      accuracy: accuracyOf(trials),
      metrics: {
        attempted: trials.length,
        correct: correct.length,
        medianRtMs: medianMs(correct.map((trial) => trial.rtMs)),
        gueltigGesehen: gueltig.length,
        gueltigTreffer: hits(gueltig),
        widerspruchGesehen: widerspruch.length,
        widerspruchTreffer: hits(widerspruch),
        fallenGesehen: fallen.length,
        fallenTreffer: hits(fallen),
        meanDifficulty:
          trials.length === 0
            ? 0
            : Math.round((trials.reduce((sum, t) => sum + t.difficulty, 0) / trials.length) * 100) / 100,
      },
    }
  },
}

export default definition
