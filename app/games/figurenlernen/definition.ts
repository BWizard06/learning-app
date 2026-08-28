import { accuracyOf, linearWeight } from '~~/shared/scoring'
import type { GameDefinition, JsonValue, RawScore, TrialResult } from '~~/shared/types'
import { generateFigurenBlock } from './generator'

const DIFFICULTY_RANGE: [number, number] = [1, 5]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 2)

const RATE_MIN = 0
const RATE_MAX = 1

function sagtGesehen(response: JsonValue): boolean {
  return response === true
}

function zahl(value: JsonValue | undefined): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function korrigierteWiedererkennungsrate(treffer: number, falscheAlarme: number, ziele: number): number {
  if (ziele <= 0) return RATE_MIN
  return Math.min(RATE_MAX, Math.max(RATE_MIN, (treffer - falscheAlarme) / ziele))
}

const definition: GameDefinition = {
  slug: 'figurenlernen',
  name: 'Figuren lernen',
  construct: 'gedaechtnis',
  blurb: 'Abstrakte Figuren einprägen, kurz rechnen, danach die gelernten Ausschnitte wiedererkennen.',
  mode: 'block',
  defaultDurationS: 300,
  itemCount: 1,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 0.3, raw4: 0.62, raw6: 0.9 },
  weight,
  generate: (difficulty, rng) => generateFigurenBlock(difficulty, rng),
  isCorrect(trial, response) {
    return sagtGesehen(response) === (trial.answer === true)
  },
  score(trials: TrialResult[], durationS: number): RawScore {
    let treffer = 0
    let falscheAlarme = 0
    let ziele = 0
    let lernzeitMs = 0
    let anzahlFiguren = 0

    for (const trial of trials) {
      lernzeitMs = Math.max(lernzeitMs, zahl(trial.params.lernzeitMs))
      anzahlFiguren = Math.max(anzahlFiguren, zahl(trial.params.anzahlFiguren))
      const gesehen = sagtGesehen(trial.response)
      if (trial.params.ziel === true) {
        ziele++
        if (gesehen) treffer++
      } else if (gesehen) {
        falscheAlarme++
      }
    }

    const rate = korrigierteWiedererkennungsrate(treffer, falscheAlarme, ziele)

    return {
      raw: rate,
      accuracy: accuracyOf(trials),
      metrics: {
        treffer,
        falscheAlarme,
        korrigierteRate: Math.round(rate * 1000) / 1000,
        lernzeitMs,
        anzahlFiguren,
      },
    }
  },
}

export default definition
