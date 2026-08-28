import { linearWeight, weightedThroughput, accuracyOf } from '~~/shared/scoring'
import type { GameDefinition, RawScore, TrialResult } from '~~/shared/types'
import { generateSymbolzahl } from './generator'

const DIFFICULTY_RANGE: [number, number] = [1, 4]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 1.5)

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = values.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const definition: GameDefinition = {
  slug: 'symbolzahl',
  name: 'Zahlen-Symbol',
  construct: 'konzentration',
  blurb: 'Neun Zeichen, neun Ziffern. Die Tabelle bleibt sichtbar, gefragt ist reines Tempo.',
  mode: 'sprint',
  defaultDurationS: 90,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 8, raw4: 26, raw6: 50 },
  weight,
  generate: (difficulty, rng) => generateSymbolzahl(difficulty, rng),
  score(trials: TrialResult[], durationS: number): RawScore {
    const correct = trials.filter((trial) => trial.correct)
    const times = correct.map((trial) => trial.rtMs)
    return {
      raw: weightedThroughput(trials, durationS, weight),
      accuracy: accuracyOf(trials),
      metrics: {
        attempted: trials.length,
        correct: correct.length,
        medianRtMs: Math.round(median(times)),
        meanRtMs: Math.round(mean(times)),
      },
    }
  },
}

export default definition
