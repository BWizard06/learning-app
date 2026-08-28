import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import type { JsonObject, TrialResult } from '~~/shared/types'
import definition from './definition'
import {
  HOBBIES,
  OPTION_COUNT,
  PROFESSIONS,
  SURNAMES,
  TOWNS,
  generateFacts,
  type FactsPayload,
  type FactsTrial,
  type RenderedProfile,
} from './generator'

const DIFFICULTIES = [1, 2, 3, 4, 5]

const EXPECTED_PROFILE_COUNT: Record<number, number> = { 1: 6, 2: 6, 3: 7, 4: 7, 5: 8 }
const EXPECTED_LEARN_SECONDS: Record<number, number> = { 1: 70, 2: 62, 3: 55, 4: 47, 5: 40 }
const EXTRA_QUESTIONS = 4

type Kind = 'ort' | 'beruf' | 'hobby'
type Format = 'attribut' | 'person'

interface Asked {
  format: Format
  kind: Kind
  subject: string
  expected: string
}

const PATTERNS: readonly { re: RegExp; format: Format; kind: Kind }[] = [
  { re: /^Wo wohnt (.+)\?$/, format: 'attribut', kind: 'ort' },
  { re: /^Welchen Beruf hat (.+)\?$/, format: 'attribut', kind: 'beruf' },
  { re: /^Welches Hobby hat (.+)\?$/, format: 'attribut', kind: 'hobby' },
  { re: /^Wer wohnt in (.+)\?$/, format: 'person', kind: 'ort' },
  { re: /^Wessen Beruf ist (.+)\?$/, format: 'person', kind: 'beruf' },
  { re: /^Wessen Hobby ist (.+)\?$/, format: 'person', kind: 'hobby' },
]

function rowOfPerson(rows: readonly RenderedProfile[], person: string): RenderedProfile {
  const hits = rows.filter((row) => row.person === person)
  expect(hits.length, `person ${person} matches ${hits.length} profiles`).toBe(1)
  return hits[0]!
}

function rowWithValue(rows: readonly RenderedProfile[], kind: Kind, value: string): RenderedProfile {
  const hits = rows.filter((row) => row[kind] === value)
  expect(hits.length, `${kind} ${value} matches ${hits.length} profiles`).toBe(1)
  return hits[0]!
}

function readQuestion(text: string, rows: readonly RenderedProfile[]): Asked {
  for (const pattern of PATTERNS) {
    const match = pattern.re.exec(text)
    if (!match) continue
    const token = match[1]!
    if (pattern.format === 'attribut') {
      const row = rowOfPerson(rows, token)
      return { format: 'attribut', kind: pattern.kind, subject: row.person, expected: row[pattern.kind] }
    }
    const row = rowWithValue(rows, pattern.kind, token)
    return { format: 'person', kind: pattern.kind, subject: row.person, expected: row.person }
  }
  throw new Error(`question not readable: ${text}`)
}

function ownerOf(rows: readonly RenderedProfile[], asked: Asked, label: string): string {
  return asked.format === 'person'
    ? rowOfPerson(rows, label).person
    : rowWithValue(rows, asked.kind, label).person
}

function setFor(difficulty: number, seed: number): FactsTrial {
  return generateFacts(difficulty, createRng(seed >>> 0))
}

function eachSet(salt: number, runs: number, visit: (trial: FactsTrial, difficulty: number) => void) {
  for (let i = 0; i < runs; i++) {
    const difficulty = DIFFICULTIES[i % DIFFICULTIES.length]!
    visit(setFor(difficulty, i * salt + 1), difficulty)
  }
}

describe('faktenlernen generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      minItemTypes: 3,
      checkTrial: (trial, difficulty) => {
        const payload = trial.payload as FactsPayload
        const answer = trial.answer as number[]
        expect(payload.profiles.length).toBe(EXPECTED_PROFILE_COUNT[difficulty])
        expect(payload.questions.length).toBe(payload.profiles.length + EXTRA_QUESTIONS)
        expect(answer.length).toBe(payload.questions.length)
        for (const question of payload.questions) {
          expect(question.options.length).toBe(OPTION_COUNT)
          expect(new Set(question.options).size).toBe(OPTION_COUNT)
        }
        for (const index of answer) {
          expect(index).toBeGreaterThanOrEqual(0)
          expect(index).toBeLessThan(OPTION_COUNT)
        }
      },
    })
  })

  it('keeps every pool duplicate free and disjoint from the other pools', () => {
    expect(SURNAMES.length).toBeGreaterThanOrEqual(30)
    expect(TOWNS.length).toBeGreaterThanOrEqual(20)
    expect(PROFESSIONS.length).toBeGreaterThanOrEqual(25)
    expect(HOBBIES.length).toBeGreaterThanOrEqual(25)

    const pools: readonly (readonly string[])[] = [SURNAMES, TOWNS, PROFESSIONS, HOBBIES]
    const everything: string[] = []
    for (const pool of pools) {
      expect(new Set(pool).size, `duplicate inside ${pool.slice(0, 3).join(', ')}`).toBe(pool.length)
      everything.push(...pool)
    }
    expect(new Set(everything).size, 'a value shows up in two pools').toBe(everything.length)
  })

  it('never repeats an attribute value inside one set of profiles', () => {
    eachSet(2654435761, propertyRuns(), (trial) => {
      const rows = trial.payload.profiles
      for (const key of ['person', 'ort', 'beruf', 'hobby'] as const) {
        const values = rows.map((row) => row[key])
        expect(new Set(values).size, `${key} repeats in ${values.join(' | ')}`).toBe(values.length)
      }
      const mixed = rows.flatMap((row) => [row.person, row.ort, row.beruf, row.hobby])
      expect(new Set(mixed).size, 'one value serves two attributes').toBe(mixed.length)
    })
  })

  it('marks exactly one option of every question as correct', () => {
    eachSet(104729, propertyRuns(), (trial) => {
      const rows = trial.payload.profiles
      trial.payload.questions.forEach((question, index) => {
        const asked = readQuestion(question.text, rows)
        const hits = question.options
          .map((label, position) => (label === asked.expected ? position : -1))
          .filter((position) => position >= 0)
        expect(hits.length, `${question.text} has ${hits.length} correct options`).toBe(1)
        expect(trial.answer[index], `${question.text} points at the wrong option`).toBe(hits[0])
      })
    })
  })

  it('draws every distractor from another profile of the same set', () => {
    eachSet(7919, Math.min(propertyRuns(), 4000), (trial) => {
      const rows = trial.payload.profiles
      const people = rows.map((row) => row.person)
      for (const question of trial.payload.questions) {
        const asked = readQuestion(question.text, rows)
        const owners = question.options.map((label) => ownerOf(rows, asked, label))
        expect(new Set(owners).size, 'two options come from the same profile').toBe(owners.length)
        for (const owner of owners) expect(people).toContain(owner)
        expect(owners.filter((owner) => owner === asked.subject).length).toBe(1)
      }
    })
  })

  it('asks about every profile at least once', () => {
    eachSet(15485863, Math.min(propertyRuns(), 4000), (trial) => {
      const rows = trial.payload.profiles
      const subjects = trial.payload.questions.map((question) => readQuestion(question.text, rows).subject)
      expect([...new Set(subjects)].sort()).toEqual(rows.map((row) => row.person).sort())
    })
  })

  it('never asks about the same person and attribute twice in one set', () => {
    eachSet(32452843, Math.min(propertyRuns(), 4000), (trial) => {
      const rows = trial.payload.profiles
      const keys = trial.payload.questions.map((question) => {
        const asked = readQuestion(question.text, rows)
        return `${asked.subject}:${asked.kind}`
      })
      expect(new Set(keys).size, `a fact is asked twice: ${keys.join(' | ')}`).toBe(keys.length)
    })
  })

  it('reaches both question formats and all three attributes at the lowest difficulty', () => {
    const runs = Math.max(600, Math.min(propertyRuns(), 3000))
    const formats = new Set<string>()
    const kinds = new Set<string>()

    for (let i = 0; i < runs; i++) {
      const trial = setFor(1, i * 99991 + 5)
      const rows = trial.payload.profiles
      const setFormats = new Set<string>()
      const setKinds = new Set<string>()
      for (const question of trial.payload.questions) {
        const asked = readQuestion(question.text, rows)
        setFormats.add(asked.format)
        setKinds.add(asked.kind)
        formats.add(asked.format)
        kinds.add(asked.kind)
      }
      expect([...setFormats].sort(), 'a set at difficulty one misses a question format').toEqual([
        'attribut',
        'person',
      ])
      expect([...setKinds].sort(), 'a set at difficulty one misses an attribute').toEqual([
        'beruf',
        'hobby',
        'ort',
      ])
    }

    expect([...formats].sort()).toEqual(['attribut', 'person'])
    expect([...kinds].sort()).toEqual(['beruf', 'hobby', 'ort'])
  })

  it('scales the number of profiles with the difficulty', () => {
    const seen: Record<number, number> = {}
    for (const difficulty of DIFFICULTIES) {
      const counts = new Set<number>()
      for (let i = 0; i < 300; i++) {
        counts.add(setFor(difficulty, i * 2246822519 + difficulty).payload.profiles.length)
      }
      expect(counts.size, `difficulty ${difficulty} varies the profile count`).toBe(1)
      const count = [...counts][0]!
      expect(count).toBe(EXPECTED_PROFILE_COUNT[difficulty])
      expect(count).toBeGreaterThanOrEqual(6)
      expect(count).toBeLessThanOrEqual(8)
      seen[difficulty] = count
    }
    for (let difficulty = 2; difficulty <= 5; difficulty++) {
      expect(seen[difficulty]!).toBeGreaterThanOrEqual(seen[difficulty - 1]!)
    }
    expect(seen[5]!).toBeGreaterThan(seen[1]!)
  })

  it('shortens the learning window as the difficulty rises', () => {
    const seen: Record<number, number> = {}
    for (const difficulty of DIFFICULTIES) {
      const trial = setFor(difficulty, difficulty * 7717 + 3)
      const learnS = trial.payload.learnS
      expect(learnS).toBe(EXPECTED_LEARN_SECONDS[difficulty])
      expect(learnS).toBeGreaterThanOrEqual(40)
      expect(learnS).toBeLessThanOrEqual(70)
      expect(trial.payload.distractionS).toBe(20)
      seen[difficulty] = learnS
    }
    for (let difficulty = 2; difficulty <= 5; difficulty++) {
      expect(seen[difficulty]!).toBeLessThan(seen[difficulty - 1]!)
    }
  })

  it('spreads the correct option over all four positions', () => {
    const runs = Math.max(1200, Math.min(propertyRuns(), 3000))
    const counts = [0, 0, 0, 0]
    let total = 0
    eachSet(1103515245, runs, (trial) => {
      for (const index of trial.answer) {
        counts[index]!++
        total++
      }
    })
    expect(total).toBeGreaterThan(runs * 9)
    for (const count of counts) {
      const share = count / total
      expect(share).toBeGreaterThan(0.22)
      expect(share).toBeLessThan(0.28)
    }
  })

  it('picks the form of address from the rng and not from the surname', () => {
    const runs = Math.max(600, Math.min(propertyRuns(), 2000))
    const perName = new Map<string, Set<string>>()
    eachSet(48271, runs, (trial) => {
      const profiles = (trial.params as JsonObject).profiles as { anrede: string; name: string }[]
      for (const profile of profiles) {
        expect(['Frau', 'Herr']).toContain(profile.anrede)
        const bucket = perName.get(profile.name) ?? new Set<string>()
        bucket.add(profile.anrede)
        perName.set(profile.name, bucket)
      }
    })
    expect(perName.size).toBe(SURNAMES.length)
    const single = [...perName.entries()].filter(([, forms]) => forms.size < 2).map(([name]) => name)
    expect(single, 'a surname is stuck on one form of address').toEqual([])
  })

  it('supplies neutral two digit numbers for the distraction phase', () => {
    let even = 0
    let odd = 0
    eachSet(6364136, 400, (trial) => {
      const payload = trial.payload
      expect(payload.distractionOptions).toEqual(['gerade', 'ungerade'])
      expect(payload.distractionPrompt.length).toBeGreaterThan(0)
      expect(payload.distractionNumbers.length).toBeGreaterThanOrEqual(payload.distractionS)
      for (const value of payload.distractionNumbers) {
        expect(Number.isInteger(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(12)
        expect(value).toBeLessThanOrEqual(99)
        if (value % 2 === 0) even++
        else odd++
      }
    })
    expect(even).toBeGreaterThan(0)
    expect(odd).toBeGreaterThan(0)
  })

  it('mirrors the set in params without leaking the rendered prose', () => {
    eachSet(1000003, Math.min(propertyRuns(), 1500), (trial) => {
      const params = trial.params as JsonObject
      const payload = trial.payload
      const profiles = params.profiles as { anrede: string; name: string; ort: string; beruf: string; hobby: string }[]
      const questions = params.questions as {
        format: Format
        kind: Kind
        profile: number
        options: number[]
        correctIndex: number
      }[]

      expect(params.profileCount).toBe(payload.profiles.length)
      expect(params.learnMs).toBe(payload.learnS * 1000)
      expect(params.distractionMs).toBe(payload.distractionS * 1000)
      expect(params.distraction).toEqual(payload.distractionNumbers)
      expect(profiles.length).toBe(payload.profiles.length)

      profiles.forEach((profile, index) => {
        const rendered = payload.profiles[index]!
        expect(`${profile.anrede} ${profile.name}`).toBe(rendered.person)
        expect(profile.ort).toBe(rendered.ort)
        expect(profile.beruf).toBe(rendered.beruf)
        expect(profile.hobby).toBe(rendered.hobby)
      })

      expect(questions.length).toBe(payload.questions.length)
      questions.forEach((question, index) => {
        const rendered = payload.questions[index]!
        expect(question.options.length).toBe(OPTION_COUNT)
        expect(new Set(question.options).size).toBe(OPTION_COUNT)
        expect(question.options[question.correctIndex]).toBe(question.profile)
        expect(question.correctIndex).toBe(trial.answer[index])
        question.options.forEach((source, position) => {
          const row = payload.profiles[source]!
          const expected = question.format === 'person' ? row.person : row[question.kind]
          expect(rendered.options[position]).toBe(expected)
        })
      })

      const serialised = JSON.stringify(params)
      expect(serialised).not.toContain('?')
      expect(serialised).not.toContain('Wessen')
      expect(serialised).not.toContain('wohnt')
    })
  })

  it('produces the same set twice for the same seed', () => {
    for (const difficulty of DIFFICULTIES) {
      const first = generateFacts(difficulty, createRng(20260828))
      const second = generateFacts(difficulty, createRng(20260828))
      expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    }
  })
})

describe('faktenlernen scoring', () => {
  function resultFor(trial: FactsTrial, response: number[], rtMs = 120000): TrialResult {
    return {
      idx: 0,
      itemType: trial.itemType,
      difficulty: trial.difficulty,
      params: trial.params,
      response,
      correct: false,
      rtMs,
      presentedAt: 0,
    }
  }

  function wrongOf(index: number): number {
    return (index + 1) % OPTION_COUNT
  }

  it('keeps the definition on the agreed settings', () => {
    expect(definition.slug).toBe('faktenlernen')
    expect(definition.construct).toBe('gedaechtnis')
    expect(definition.mode).toBe('block')
    expect(definition.itemCount).toBe(1)
    expect(definition.defaultDurationS).toBe(300)
    expect(definition.difficultyRange).toEqual([1, 5])
    expect(definition.thresholds).toEqual({ raw1: 0.3, raw4: 0.65, raw6: 0.92 })
    expect(definition.scoresCorrectness).not.toBe(false)
    expect(definition.weight(1)).toBe(1)
    expect(definition.weight(5)).toBe(2)
  })

  it('reports the share of correct recall answers as the raw value', () => {
    const trial = generateFacts(3, createRng(11))
    const mixed = trial.answer.map((value, index) => (index % 2 === 0 ? value : wrongOf(value)))
    const expectedKorrekt = Math.ceil(trial.answer.length / 2)

    const score = definition.score([resultFor(trial, mixed)], 300)

    expect(score.metrics.korrekt).toBe(expectedKorrekt)
    expect(score.metrics.gesamt).toBe(trial.answer.length)
    expect(score.raw).toBeCloseTo(expectedKorrekt / trial.answer.length, 12)
    expect(score.accuracy).toBe(score.raw)
    expect(score.metrics.quote).toBeCloseTo(score.raw, 2)
  })

  it('keeps the raw value a proportion instead of a throughput', () => {
    const trial = generateFacts(2, createRng(4242))
    const result = resultFor(trial, trial.answer.slice())
    const short = definition.score([result], 60)
    const long = definition.score([result], 900)

    expect(short.raw).toBe(long.raw)
    expect(short.raw).toBe(1)
    expect(short.raw).toBeLessThanOrEqual(1)
    expect(definition.score([resultFor(trial, trial.answer.map(wrongOf))], 300).raw).toBe(0)
  })

  it('reports the metrics the result screen expects', () => {
    const trial = generateFacts(5, createRng(777))
    const score = definition.score([resultFor(trial, trial.answer.slice())], 300)

    expect(Object.keys(score.metrics).sort()).toEqual([
      'anzahlProfile',
      'gesamt',
      'korrekt',
      'lernzeitMs',
      'quote',
    ])
    expect(score.metrics.anzahlProfile).toBe(trial.payload.profiles.length)
    expect(score.metrics.lernzeitMs).toBe(trial.payload.learnS * 1000)
    expect(score.metrics.gesamt).toBe(trial.payload.questions.length)
  })

  it('handles a missing or short response without throwing', () => {
    const trial = generateFacts(4, createRng(31337))
    const score = definition.score([resultFor(trial, trial.answer.slice(0, 2))], 300)

    expect(score.metrics.gesamt).toBe(trial.answer.length)
    expect(score.metrics.korrekt).toBe(2)
    expect(score.raw).toBeCloseTo(2 / trial.answer.length, 12)

    const empty = definition.score([], 300)
    expect(empty.raw).toBe(0)
    expect(empty.accuracy).toBe(0)
    expect(empty.metrics.gesamt).toBe(0)
    expect(empty.metrics.anzahlProfile).toBe(0)
  })

  it('accepts a run only when every recall answer matches', () => {
    const trial = generateFacts(3, createRng(2718))
    expect(definition.isCorrect!(trial, trial.answer.slice())).toBe(true)

    const oneOff = trial.answer.slice()
    oneOff[0] = wrongOf(oneOff[0]!)
    expect(definition.isCorrect!(trial, oneOff)).toBe(false)
    expect(definition.isCorrect!(trial, trial.answer.slice(0, -1))).toBe(false)
    expect(definition.isCorrect!(trial, [])).toBe(false)
  })
})
