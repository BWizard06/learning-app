import { accuracyOf, linearWeight, median, weightedThroughput } from '~~/shared/scoring'
import type { GameDefinition, RawScore, TrialResult } from '~~/shared/types'
import { generateDatenlesen } from './generator'

const DIFFICULTY_RANGE: [number, number] = [1, 6]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 2.2)

const RECHEN_KINDS = ['differenz', 'anteil']

function kindOf(itemType: string): string {
  const parts = itemType.split('-')
  return parts.length > 1 ? parts[1]! : itemType
}

function chartOf(itemType: string): string {
  return itemType.split('-')[0] ?? itemType
}

const definition: GameDefinition = {
  slug: 'datenlesen',
  name: 'Tabellen und Diagramme',
  construct: 'rechnen',
  blurb: 'Werte aus Balken, Linien, Kreisen und Tabellen ablesen und rasch verrechnen.',
  mode: 'sprint',
  defaultDurationS: 150,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 1.5, raw4: 6, raw6: 13 },
  weight,
  generate: (difficulty, rng) => generateDatenlesen(difficulty, rng),
  score(trials: TrialResult[], durationS: number): RawScore {
    const correct = trials.filter((trial) => trial.correct)
    const rechen = correct.filter((trial) => RECHEN_KINDS.includes(kindOf(trial.itemType)))
    const tabelle = correct.filter((trial) => chartOf(trial.itemType) === 'tabelle')

    return {
      raw: weightedThroughput(trials, durationS, weight),
      accuracy: accuracyOf(trials),
      metrics: {
        attempted: trials.length,
        correct: correct.length,
        rechenTreffer: rechen.length,
        lesenTreffer: correct.length - rechen.length,
        tabelleTreffer: tabelle.length,
        diagrammTreffer: correct.length - tabelle.length,
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
