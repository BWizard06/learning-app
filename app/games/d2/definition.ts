import { linearWeight } from '~~/shared/scoring'
import type { GameDefinition, JsonValue, RawScore, TrialResult } from '~~/shared/types'
import { charsFromParams, generateRow, indexList } from './generator'

const DIFFICULTY_RANGE: [number, number] = [1, 6]
const weight = linearWeight(DIFFICULTY_RANGE, 1, 2)

interface RowTally {
  treffer: number
  auslassungen: number
  verwechslungen: number
  bearbeitet: number
}

function tally(result: TrialResult): RowTally {
  const chars = charsFromParams(result.params)
  const targets = new Set(indexList(result.params.targets, chars.length))
  const marked = indexList(result.response, chars.length)

  let treffer = 0
  for (const index of marked) {
    if (targets.has(index)) treffer++
  }

  return {
    treffer,
    auslassungen: targets.size - treffer,
    verwechslungen: marked.length - treffer,
    bearbeitet: chars.length,
  }
}

const definition: GameDefinition = {
  slug: 'd2',
  name: 'Durchstreichtest',
  construct: 'konzentration',
  blurb: 'Zeile für Zeile jedes d mit genau zwei Strichen finden, schnell und ohne Aussetzer.',
  mode: 'block',
  defaultDurationS: 180,
  itemCount: 10,
  difficultyRange: DIFFICULTY_RANGE,
  thresholds: { raw1: 8, raw4: 30, raw6: 60 },
  weight,
  generate: (difficulty, rng) => generateRow(difficulty, rng),
  isCorrect(trial, response) {
    const chars = Array.isArray(trial.payload) ? (trial.payload as unknown[]).length : undefined
    const expected = indexList(trial.answer as JsonValue, chars)
    const given = indexList(response, chars)
    return expected.length === given.length && expected.every((value, i) => value === given[i])
  },
  score(trials: TrialResult[], durationS: number): RawScore {
    let treffer = 0
    let auslassungen = 0
    let verwechslungen = 0
    let bearbeitet = 0
    let weightedNet = 0
    const times: number[] = []

    for (const trial of trials) {
      const row = tally(trial)
      treffer += row.treffer
      auslassungen += row.auslassungen
      verwechslungen += row.verwechslungen
      bearbeitet += row.bearbeitet
      weightedNet += weight(trial.difficulty) * (row.treffer - row.auslassungen - row.verwechslungen)
      times.push(trial.rtMs)
    }

    const fehler = auslassungen + verwechslungen
    const minutes = durationS > 0 ? durationS / 60 : 0
    const raw = minutes > 0 ? Math.max(0, weightedNet / minutes) : 0

    return {
      raw,
      accuracy: bearbeitet > 0 ? Math.max(0, (bearbeitet - fehler) / bearbeitet) : 0,
      metrics: {
        zeilen: trials.length,
        treffer,
        auslassungen,
        verwechslungen,
        bearbeitet,
        fehlerprozent: bearbeitet > 0 ? Math.round((fehler / bearbeitet) * 1000) / 10 : 0,
        schwankungsbreite: times.length > 0 ? Math.max(...times) - Math.min(...times) : 0,
      },
    }
  },
}

export default definition
