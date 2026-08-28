import { accuracyOf, linearWeight, median, weightedThroughput } from '~~/shared/scoring'
import type { GameDefinition, RawScore, TrialResult } from '~~/shared/types'
import { INKONGRUENT, KONGRUENT, generateStroop } from './generator'

const DIFFICULTY_RANGE: [number, number] = [1, 4]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 1.4)

function medianMs(values: number[]): number {
  return values.length === 0 ? 0 : Math.round(median(values))
}

const definition: GameDefinition = {
  slug: 'stroop',
  name: 'Stroop',
  construct: 'konzentration',
  blurb: 'Nicht das Wort zählt, sondern die Farbe der Schrift. Wenig Zeit pro Wort.',
  mode: 'sprint',
  defaultDurationS: 90,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 10, raw4: 34, raw6: 62 },
  weight,
  generate: (difficulty, rng) => generateStroop(difficulty, rng),
  score(trials: TrialResult[], durationS: number): RawScore {
    const correct = trials.filter((trial) => trial.correct)
    const kongruent = correct.filter((trial) => trial.itemType === KONGRUENT).map((trial) => trial.rtMs)
    const inkongruent = correct.filter((trial) => trial.itemType === INKONGRUENT).map((trial) => trial.rtMs)
    const kongruentMs = medianMs(kongruent)
    const inkongruentMs = medianMs(inkongruent)
    const bothSeen = kongruent.length > 0 && inkongruent.length > 0

    return {
      raw: weightedThroughput(trials, durationS, weight),
      accuracy: accuracyOf(trials),
      metrics: {
        attempted: trials.length,
        correct: correct.length,
        kongruentTreffer: kongruent.length,
        inkongruentTreffer: inkongruent.length,
        kongruentMs,
        inkongruentMs,
        interferenzMs: bothSeen ? inkongruentMs - kongruentMs : 0,
      },
    }
  },
}

export default definition
