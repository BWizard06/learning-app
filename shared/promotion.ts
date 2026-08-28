import { EXAM_CONSTRUCTS, CONSTRUCT_LABELS, type Construct } from './types'

export const PASS_NOTE = 4
export const HARD_FLOOR = 3
export const TEXT_WEIGHT = 2

export const GROUP_A: Construct[] = ['rechnen', 'konzentration']
export const GROUP_B: Construct[] = ['logik', 'sprache', 'wortfluss', 'text']

export type PartNotes = Partial<Record<Construct, number>>

export type RuleId = 'durchschnitt' | 'gruppe-a' | 'gruppe-b' | 'gruppe-b-untergrenze'

export interface RuleResult {
  id: RuleId
  label: string
  passed: boolean
  detail: string
}

export interface PromotionVerdict {
  passed: boolean
  complete: boolean
  average: number | null
  weights: Record<string, number>
  rules: RuleResult[]
  brokenRules: RuleId[]
  missingParts: Construct[]
  missingLabels: string[]
}

export function roundHalfUp(value: number, digits = 2): number {
  const factor = 10 ** digits
  const scaled = value * factor
  const nudged = scaled + (scaled >= 0 ? 1e-9 : -1e-9)
  return Math.sign(nudged) * Math.round(Math.abs(nudged)) / factor
}

export function weightOf(construct: Construct): number {
  return construct === 'text' ? TEXT_WEIGHT : 1
}

export function weightedAverage(notes: PartNotes): number | null {
  let sum = 0
  let weight = 0
  for (const construct of EXAM_CONSTRUCTS) {
    const note = notes[construct]
    if (note === undefined) continue
    sum += note * weightOf(construct)
    weight += weightOf(construct)
  }
  if (weight === 0) return null
  return roundHalfUp(sum / weight, 2)
}

function below(notes: PartNotes, group: readonly Construct[], threshold: number): Construct[] {
  return group.filter((construct) => {
    const note = notes[construct]
    return note !== undefined && note < threshold
  })
}

function listOf(constructs: readonly Construct[]): string {
  return constructs.map((construct) => CONSTRUCT_LABELS[construct]).join(' und ')
}

export function evaluatePromotion(notes: PartNotes): PromotionVerdict {
  const missingParts = EXAM_CONSTRUCTS.filter((construct) => notes[construct] === undefined)
  const average = weightedAverage(notes)

  const failingA = below(notes, GROUP_A, PASS_NOTE)
  const failingB = below(notes, GROUP_B, PASS_NOTE)
  const underFloorB = below(notes, GROUP_B, HARD_FLOOR)

  const rules: RuleResult[] = [
    {
      id: 'durchschnitt',
      label: 'Notendurchschnitt mindestens 4,00, Textverständnis doppelt gewichtet',
      passed: average !== null && average >= PASS_NOTE,
      detail:
        average === null
          ? 'noch kein Durchschnitt berechenbar'
          : `Durchschnitt ${average.toFixed(2).replace('.', ',')}`,
    },
    {
      id: 'gruppe-a',
      label: 'Von Rechnerischem Denken und Konzentrationsleistung höchstens eines unter 4,0',
      passed: failingA.length <= 1,
      detail:
        failingA.length === 0
          ? 'beide auf oder über 4,0'
          : `${failingA.length} unter 4,0: ${listOf(failingA)}`,
    },
    {
      id: 'gruppe-b',
      label:
        'Von Logischem Denken, Sprachlichem Denken, Wortflüssigkeit und Textverständnis höchstens eines unter 4,0',
      passed: failingB.length <= 1,
      detail:
        failingB.length === 0
          ? 'alle auf oder über 4,0'
          : `${failingB.length} unter 4,0: ${listOf(failingB)}`,
    },
    {
      id: 'gruppe-b-untergrenze',
      label: 'Dieser eine Ausreisser darf nicht unter 3,0 liegen',
      passed: underFloorB.length === 0,
      detail:
        underFloorB.length === 0
          ? 'keiner unter 3,0'
          : `unter 3,0: ${listOf(underFloorB)}`,
    },
  ]

  const brokenRules = rules.filter((rule) => !rule.passed).map((rule) => rule.id)

  return {
    passed: brokenRules.length === 0,
    complete: missingParts.length === 0,
    average,
    weights: Object.fromEntries(EXAM_CONSTRUCTS.map((c) => [c, weightOf(c)])),
    rules,
    brokenRules,
    missingParts,
    missingLabels: missingParts.map((construct) => CONSTRUCT_LABELS[construct]),
  }
}
