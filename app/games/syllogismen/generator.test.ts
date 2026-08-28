import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import type { JsonObject } from '~~/shared/types'
import definition from './definition'
import {
  FIGURES,
  FORMS,
  TERMS,
  VERDICTS,
  VERDICT_LABELS,
  generateSyllogism,
  itemTypeOf,
  premiseModelCount,
  verdictFor,
  verdictWithImport,
  type Figure,
  type Form,
  type SyllogismPayload,
  type Verdict,
} from './generator'

type Role = 'S' | 'P' | 'M'

const LAYOUT: Record<number, readonly [Role, Role, Role, Role]> = {
  1: ['M', 'P', 'S', 'M'],
  2: ['P', 'M', 'S', 'M'],
  3: ['M', 'P', 'M', 'S'],
  4: ['P', 'M', 'M', 'S'],
}

const DISTRIBUTES_SUBJECT: Record<Form, boolean> = { A: true, E: true, I: false, O: false }
const DISTRIBUTES_PREDICATE: Record<Form, boolean> = { A: false, E: true, I: false, O: true }
const NEGATIVE: Record<Form, boolean> = { A: false, E: true, I: false, O: true }
const UNIVERSAL: Record<Form, boolean> = { A: true, E: true, I: false, O: false }
const CONTRADICTORY: Record<Form, Form> = { A: 'O', O: 'A', E: 'I', I: 'E' }

const VALID_MOODS: Record<number, readonly string[]> = {
  1: ['AAA', 'EAE', 'AII', 'EIO'],
  2: ['EAE', 'AEE', 'EIO', 'AOO'],
  3: ['AII', 'IAI', 'EIO', 'OAO'],
  4: ['AEE', 'IAI', 'EIO'],
}

const IMPORT_ONLY_MOODS: Record<number, readonly string[]> = {
  1: ['AAI', 'EAO'],
  2: ['EAO', 'AEO'],
  3: ['AAI', 'EAO'],
  4: ['AAI', 'EAO', 'AEO'],
}

function distributed(form: Form, subject: Role, predicate: Role): Set<Role> {
  const marked = new Set<Role>()
  if (DISTRIBUTES_SUBJECT[form]) marked.add(subject)
  if (DISTRIBUTES_PREDICATE[form]) marked.add(predicate)
  return marked
}

function validByRules(figure: Figure, major: Form, minor: Form, conclusion: Form): boolean {
  const [majorSubject, majorPredicate, minorSubject, minorPredicate] = LAYOUT[figure]!
  const inMajor = distributed(major, majorSubject, majorPredicate)
  const inMinor = distributed(minor, minorSubject, minorPredicate)
  const inConclusion = distributed(conclusion, 'S', 'P')

  if (!inMajor.has('M') && !inMinor.has('M')) return false

  for (const role of inConclusion) {
    const heldByMajor = (majorSubject === role || majorPredicate === role) && inMajor.has(role)
    const heldByMinor = (minorSubject === role || minorPredicate === role) && inMinor.has(role)
    if (!heldByMajor && !heldByMinor) return false
  }

  if (NEGATIVE[major] && NEGATIVE[minor]) return false
  if ((NEGATIVE[major] || NEGATIVE[minor]) !== NEGATIVE[conclusion]) return false
  if (UNIVERSAL[major] && UNIVERSAL[minor] && !UNIVERSAL[conclusion]) return false

  return true
}

function verdictByRules(figure: Figure, major: Form, minor: Form, conclusion: Form): Verdict {
  if (validByRules(figure, major, minor, conclusion)) return 'folgt'
  if (validByRules(figure, major, minor, CONTRADICTORY[conclusion])) return 'widerspricht'
  return 'folgt-nicht'
}

function moodOf(major: Form, minor: Form, conclusion: Form): string {
  return `${major}${minor}${conclusion}`
}

function isImportTrap(figure: Figure, major: Form, minor: Form, conclusion: Form): boolean {
  return IMPORT_ONLY_MOODS[figure]!.includes(moodOf(major, minor, conclusion))
}

function readParams(params: JsonObject) {
  return {
    figure: Number(params.figure) as Figure,
    major: String(params.major) as Form,
    minor: String(params.minor) as Form,
    conclusion: String(params.conclusion) as Form,
    subject: Number(params.subject),
    predicate: Number(params.predicate),
    middle: Number(params.middle),
  }
}

const HEAD: Record<Form, string> = { A: 'Alle', E: 'Keine', I: 'Einige', O: 'Einige' }

function expectSentence(line: string, form: Form, subject: string, predicate: string) {
  expect(line.startsWith(`${HEAD[form]} ${subject} sind `), line).toBe(true)
  expect(line.endsWith(form === 'O' ? `keine ${predicate}.` : `${predicate}.`), line).toBe(true)
  expect(line.includes(' keine '), line).toBe(form === 'O')
}

function expectPayloadFromParams(params: JsonObject, payload: SyllogismPayload) {
  const item = readParams(params)
  const words: Record<Role, string> = {
    S: TERMS[item.subject]!,
    P: TERMS[item.predicate]!,
    M: TERMS[item.middle]!,
  }
  const [majorSubject, majorPredicate, minorSubject, minorPredicate] = LAYOUT[item.figure]!

  expectSentence(payload.premises[0], item.major, words[majorSubject], words[majorPredicate])
  expectSentence(payload.premises[1], item.minor, words[minorSubject], words[minorPredicate])
  expectSentence(payload.conclusion, item.conclusion, words.S, words.P)
}

function everyCombination(visit: (figure: Figure, major: Form, minor: Form, conclusion: Form) => void) {
  for (const figure of FIGURES) {
    for (const major of FORMS) {
      for (const minor of FORMS) {
        for (const conclusion of FORMS) {
          visit(figure, major, minor, conclusion)
        }
      }
    }
  }
}

describe('syllogismen model checker', () => {
  it('agrees with the classical rules of distribution and quality', () => {
    let checked = 0
    everyCombination((figure, major, minor, conclusion) => {
      const label = itemTypeOf(figure, major, minor, conclusion)
      expect(verdictFor(figure, major, minor, conclusion), label).toBe(
        verdictByRules(figure, major, minor, conclusion),
      )
      checked++
    })
    expect(checked).toBe(256)
  })

  it('calls exactly the fifteen unconditionally valid moods valid', () => {
    const found: string[] = []
    everyCombination((figure, major, minor, conclusion) => {
      if (verdictFor(figure, major, minor, conclusion) === 'folgt') {
        found.push(itemTypeOf(figure, major, minor, conclusion))
      }
    })
    const expectedList = FIGURES.flatMap((figure) =>
      VALID_MOODS[figure]!.map((mood) => `${mood}-${figure}`),
    )
    expect(found.sort()).toEqual(expectedList.sort())
    expect(expectedList.length).toBe(15)
  })

  it('adds the nine conditional moods once every term is non empty', () => {
    const found: string[] = []
    everyCombination((figure, major, minor, conclusion) => {
      if (verdictWithImport(figure, major, minor, conclusion) === 'folgt') {
        found.push(itemTypeOf(figure, major, minor, conclusion))
      }
    })
    const expectedList = FIGURES.flatMap((figure) => [
      ...VALID_MOODS[figure]!.map((mood) => `${mood}-${figure}`),
      ...IMPORT_ONLY_MOODS[figure]!.map((mood) => `${mood}-${figure}`),
    ])
    expect(found.sort()).toEqual(expectedList.sort())
    expect(expectedList.length).toBe(24)
  })

  it('never builds a premise pair without a model', () => {
    for (const figure of FIGURES) {
      for (const major of FORMS) {
        for (const minor of FORMS) {
          expect(premiseModelCount(figure, major, minor), itemTypeOf(figure, major, minor, 'A'))
            .toBeGreaterThan(0)
        }
      }
    }
  })
})

describe('syllogismen generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      minItemTypes: 8,
      checkTrial: (trial) => {
        const payload = trial.payload as SyllogismPayload
        expect(payload.premises).toHaveLength(2)
        expect(payload.conclusion.length).toBeGreaterThan(0)
        expect(VERDICTS).toContain(trial.answer as Verdict)
      },
    })
  })

  it('answers every generated item the way the rule based check does', () => {
    const runs = propertyRuns()
    const seen = new Set<string>()
    for (let i = 0; i < runs; i++) {
      const difficulty = (i % 6) + 1
      const trial = generateSyllogism(difficulty, createRng(i * 2246822519 + 7))
      const item = readParams(trial.params)
      seen.add(trial.itemType)
      expect(trial.itemType, `seed ${i}`).toBe(
        itemTypeOf(item.figure, item.major, item.minor, item.conclusion),
      )
      expect(trial.answer, trial.itemType).toBe(
        verdictByRules(item.figure, item.major, item.minor, item.conclusion),
      )
    }
    expect(seen.size).toBeGreaterThanOrEqual(8)
  })

  it('rebuilds the premises and the conclusion from params alone', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateSyllogism((i % 6) + 1, createRng(i * 40503 + 11))
      const item = readParams(trial.params)
      expect(new Set([item.subject, item.predicate, item.middle]).size).toBe(3)
      expectPayloadFromParams(trial.params, trial.payload as SyllogismPayload)
    }
  })

  it('reaches all three answer categories at every difficulty', () => {
    for (let difficulty = 1; difficulty <= 6; difficulty++) {
      const seen = new Set<string>()
      for (let i = 0; i < 400; i++) {
        seen.add(String(generateSyllogism(difficulty, createRng(i * 7919 + difficulty)).answer))
      }
      expect([...seen].sort(), `Stufe ${difficulty}`).toEqual([
        'folgt',
        'folgt-nicht',
        'widerspricht',
      ])
    }
  })

  it('reaches all three answer categories on the lowest difficulty alone', () => {
    const counts = new Map<string, number>()
    for (let i = 0; i < 900; i++) {
      const answer = String(generateSyllogism(1, createRng(i * 104729 + 3)).answer)
      counts.set(answer, (counts.get(answer) ?? 0) + 1)
    }
    for (const verdict of VERDICTS) {
      expect(counts.get(verdict) ?? 0, verdict).toBeGreaterThan(50)
    }
  })

  it('opens the figures and the O form only as the difficulty rises', () => {
    const survey = (difficulty: number) => {
      const figures = new Set<number>()
      const premiseForms = new Set<string>()
      let traps = 0
      let total = 0
      for (let i = 0; i < 4000; i++) {
        const item = readParams(generateSyllogism(difficulty, createRng(i * 2654435761 + 13)).params)
        figures.add(item.figure)
        premiseForms.add(item.major)
        premiseForms.add(item.minor)
        if (isImportTrap(item.figure, item.major, item.minor, item.conclusion)) traps++
        total++
      }
      return { figures, premiseForms, trapShare: traps / total }
    }

    const easiest = survey(1)
    const middle = survey(3)
    const hardest = survey(6)

    expect([...easiest.figures]).toEqual([1])
    expect([...middle.figures].sort()).toEqual([1, 2, 3])
    expect([...hardest.figures].sort()).toEqual([1, 2, 3, 4])

    for (let difficulty = 1; difficulty <= 4; difficulty++) {
      expect(survey(difficulty).premiseForms.has('O'), `Stufe ${difficulty}`).toBe(false)
    }
    expect(hardest.premiseForms.has('O')).toBe(true)
    expect(hardest.trapShare).toBeGreaterThan(easiest.trapShare * 1.5)
  })

  it('labels every answer category for the interface', () => {
    for (const verdict of VERDICTS) {
      expect(VERDICT_LABELS[verdict].length).toBeGreaterThan(0)
    }
    expect(new Set(Object.values(VERDICT_LABELS)).size).toBe(VERDICTS.length)
  })
})

describe('syllogismen scoring', () => {
  const result = (itemType: string, correct: boolean, difficulty: number, rtMs = 6000) => ({
    idx: 0,
    itemType,
    difficulty,
    params: { type: itemType } as JsonObject,
    response: 'folgt' as const,
    correct,
    rtMs,
    presentedAt: 0,
  })

  it('rewards the same accuracy at higher difficulty', () => {
    const easy = definition.score([result('AAA-1', true, 1), result('AAA-1', false, 1)], 60)
    const hard = definition.score([result('AAA-1', true, 6), result('AAA-1', false, 6)], 60)
    expect(easy.accuracy).toBe(hard.accuracy)
    expect(hard.raw).toBeGreaterThan(easy.raw)
  })

  it('counts valid conclusions, contradictions and existential traps apart', () => {
    const score = definition.score(
      [
        result('AAA-1', true, 3),
        result('AAO-1', false, 3),
        result('AAI-1', false, 3),
        result('AAI-3', true, 3),
      ],
      60,
    )
    expect(score.metrics.gueltigGesehen).toBe(1)
    expect(score.metrics.gueltigTreffer).toBe(1)
    expect(score.metrics.widerspruchGesehen).toBe(1)
    expect(score.metrics.widerspruchTreffer).toBe(0)
    expect(score.metrics.fallenGesehen).toBe(2)
    expect(score.metrics.fallenTreffer).toBe(1)
  })

  it('reports zero for an empty session without throwing', () => {
    const score = definition.score([], 60)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.medianRtMs).toBe(0)
  })
})
