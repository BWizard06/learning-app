import { accuracyOf, linearWeight, median } from '~~/shared/scoring'
import type { GameDefinition, RawScore, TrialResult } from '~~/shared/types'
import { generateSpan } from './generator'

const DIFFICULTY_RANGE: [number, number] = [3, 12]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 2)

function highestCorrectLength(trials: readonly TrialResult[], itemType?: string): number {
  let highest = 0
  for (const trial of trials) {
    if (!trial.correct) continue
    if (itemType !== undefined && trial.itemType !== itemType) continue
    if (trial.difficulty > highest) highest = trial.difficulty
  }
  return highest
}

function hasItemType(trials: readonly TrialResult[], itemType: string): boolean {
  return trials.some((trial) => trial.itemType === itemType)
}

const definition: GameDefinition = {
  slug: 'zahlenspanne',
  name: 'Zahlenspanne',
  construct: 'gedaechtnis',
  blurb: 'Ziffern erscheinen einzeln, danach tippst du die ganze Folge zurück, vorwärts oder rückwärts.',
  mode: 'span',
  defaultDurationS: 240,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 3, raw4: 6, raw6: 9 },
  weight,
  generate: (difficulty, rng) => generateSpan(difficulty, rng),
  score(trials: TrialResult[]): RawScore {
    const raw = highestCorrectLength(trials)
    const korrekt = trials.filter((trial) => trial.correct).length
    const times = trials.map((trial) => trial.rtMs)

    const metrics: Record<string, number> = { spanne: raw }
    if (hasItemType(trials, 'vorwaerts')) {
      metrics.vorwaertsSpanne = highestCorrectLength(trials, 'vorwaerts')
    }
    if (hasItemType(trials, 'rueckwaerts')) {
      metrics.rueckwaertsSpanne = highestCorrectLength(trials, 'rueckwaerts')
    }
    metrics.versuche = trials.length
    metrics.korrekt = korrekt
    metrics.medianRtMs = times.length === 0 ? 0 : Math.round(median(times))

    return {
      raw,
      accuracy: accuracyOf(trials),
      metrics,
    }
  },
}

export default definition
