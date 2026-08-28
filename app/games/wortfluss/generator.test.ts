import { describe, expect, it } from 'vitest'
import { createRng } from '~~/shared/rng'
import { runGeneratorContract } from '~~/shared/testing/generator-contract'
import { propertyRuns } from '~~/shared/testing/property'
import type { TrialResult } from '~~/shared/types'
import definition from './definition'
import {
  CATEGORIES,
  ITEM_TYPES,
  LETTERS,
  MIN_WORD_LENGTH,
  generateWortfluss,
  itemTypeFor,
  validateWord,
  type ItemType,
  type WortflussPayload,
} from './generator'

describe('wortfluss generator', () => {
  it('satisfies the shared generator contract', () => {
    runGeneratorContract(definition, {
      minItemTypes: ITEM_TYPES.length,
      checkTrial: (trial) => {
        const payload = trial.payload as WortflussPayload
        expect(trial.answer).toBeNull()
        expect(payload.prompt.length).toBeGreaterThan(0)
        expect(payload.prompt).not.toContain('ß')
      },
    })
  })

  it('names one fixed prompt kind per level', () => {
    expect(itemTypeFor(1)).toBe('buchstabe')
    expect(itemTypeFor(2)).toBe('kategorie')
    expect(itemTypeFor(3)).toBe('kombiniert')
    expect(itemTypeFor(-4)).toBe('buchstabe')
    expect(itemTypeFor(12)).toBe('kombiniert')
  })

  it('maps every difficulty to its prompt kind', () => {
    const runs = propertyRuns()
    const expected: ItemType[] = ['buchstabe', 'kategorie', 'kombiniert']
    const seen = new Set<ItemType>()
    for (let i = 0; i < runs; i++) {
      const difficulty = (i % 3) + 1
      const trial = generateWortfluss(difficulty, createRng(i * 2654435761 + 11))
      seen.add(trial.itemType as ItemType)
      expect(trial.itemType).toBe(expected[difficulty - 1])
      expect(trial.params.type).toBe(trial.itemType)
      expect(trial.difficulty).toBe(difficulty)
    }
    expect(seen).toEqual(new Set(ITEM_TYPES))
  })

  it('rebuilds the exact prompt from the parameters alone', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateWortfluss((i % 3) + 1, createRng(i * 40503 + 19))
      const payload = trial.payload as WortflussPayload
      const params = trial.params as {
        type: ItemType
        letterIndex: number | null
        categoryIndex: number | null
      }
      const letter = params.letterIndex === null ? null : LETTERS[params.letterIndex]!
      const category = params.categoryIndex === null ? null : CATEGORIES[params.categoryIndex]!

      let rebuilt: string
      if (params.type === 'buchstabe') rebuilt = `Wörter mit ${letter!.toUpperCase()}`
      else if (params.type === 'kategorie') rebuilt = `Wörter aus der Kategorie ${category}`
      else rebuilt = `${category} mit ${letter!.toUpperCase()}`

      expect(payload.prompt).toBe(rebuilt)
      expect(payload.letter).toBe(letter)
      expect(payload.category).toBe(category)
    }
  })

  it('reaches every letter and every category', () => {
    const letters = new Set<string>()
    const categories = new Set<string>()
    for (let i = 0; i < 1500; i++) {
      const payload = generateWortfluss((i % 3) + 1, createRng(i * 2246822519 + 29))
        .payload as WortflussPayload
      if (payload.letter !== null) letters.add(payload.letter)
      if (payload.category !== null) categories.add(payload.category)
    }
    expect(letters.size).toBe(LETTERS.length)
    expect(categories.size).toBe(CATEGORIES.length)
  })

  it('carries letter and category exactly where the prompt kind needs them', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateWortfluss((i % 3) + 1, createRng(i * 104729 + 7))
      const payload = trial.payload as WortflussPayload
      const params = trial.params as { letterIndex: number | null; categoryIndex: number | null }

      if (trial.itemType === 'buchstabe') {
        expect(payload.letter).not.toBeNull()
        expect(payload.category).toBeNull()
      }
      if (trial.itemType === 'kategorie') {
        expect(payload.letter).toBeNull()
        expect(payload.category).not.toBeNull()
      }
      if (trial.itemType === 'kombiniert') {
        expect(payload.letter).not.toBeNull()
        expect(payload.category).not.toBeNull()
      }

      if (payload.letter !== null) {
        expect(LETTERS).toContain(payload.letter)
        expect(LETTERS[params.letterIndex!]).toBe(payload.letter)
        expect(payload.prompt).toContain(payload.letter.toUpperCase())
      }
      if (payload.category !== null) {
        expect(CATEGORIES).toContain(payload.category)
        expect(CATEGORIES[params.categoryIndex!]).toBe(payload.category)
        expect(payload.prompt).toContain(payload.category)
      }
    }
  })

  it('avoids the letters that carry no German vocabulary', () => {
    for (const forbidden of ['q', 'x', 'y']) {
      expect(LETTERS).not.toContain(forbidden)
    }
    expect(new Set(LETTERS).size).toBe(LETTERS.length)
    expect(new Set(CATEGORIES).size).toBe(CATEGORIES.length)
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(25)
  })

  it('keeps rendered text out of params', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateWortfluss((i % 3) + 1, createRng(i * 7919 + 3))
      const payload = trial.payload as WortflussPayload
      const serialised = JSON.stringify(trial.params)
      expect(serialised).not.toContain(payload.prompt)
      expect(Object.keys(trial.params).sort()).toEqual(['categoryIndex', 'letterIndex', 'type'])
    }
  })

  it('clamps a difficulty outside the declared range', () => {
    expect(generateWortfluss(0, createRng(1)).difficulty).toBe(1)
    expect(generateWortfluss(9, createRng(1)).difficulty).toBe(3)
    expect(generateWortfluss(0, createRng(1)).itemType).toBe('buchstabe')
    expect(generateWortfluss(9, createRng(1)).itemType).toBe('kombiniert')
  })
})

describe('wortfluss validation', () => {
  it('rejects a word below the minimum length', () => {
    const check = validateWord('ab', 'a', [])
    expect(check.ok).toBe(false)
    expect(check.reason).toBe('kurz')
    expect(MIN_WORD_LENGTH).toBe(3)
    expect(validateWord('Aal', 'a', []).ok).toBe(true)
  })

  it('rejects a word that starts with the wrong letter', () => {
    const check = validateWord('Baum', 'a', [])
    expect(check.ok).toBe(false)
    expect(check.reason).toBe('buchstabe')
    expect(validateWord('Baum', 'b', []).ok).toBe(true)
  })

  it('ignores the starting letter when only a category is asked for', () => {
    expect(validateWord('Baum', null, []).ok).toBe(true)
    expect(validateWord('Zebra', null, []).ok).toBe(true)
  })

  it('rejects a duplicate regardless of case', () => {
    const check = validateWord('bAuM', 'b', ['Baum'])
    expect(check.ok).toBe(false)
    expect(check.reason).toBe('doppelt')
    expect(validateWord('BAUM', 'b', ['baum', 'birne']).reason).toBe('doppelt')
    expect(validateWord('Birke', 'b', ['baum', 'birne']).ok).toBe(true)
  })

  it('accepts umlauts and the sharp s', () => {
    expect(validateWord('Bär', 'b', []).ok).toBe(true)
    expect(validateWord('Öfen', null, []).ok).toBe(true)
    expect(validateWord('Übung', 'ü', []).ok).toBe(true)
    expect(validateWord('Strasse', 's', []).ok).toBe(true)
    expect(validateWord('Straße', 's', []).ok).toBe(true)
    expect(validateWord('Bär', 'b', ['bär']).reason).toBe('doppelt')
  })

  it('accepts hyphenated words but not a stray hyphen', () => {
    expect(validateWord('E-Mail', 'e', []).ok).toBe(true)
    expect(validateWord('Ess-Stäbchen', 'e', []).ok).toBe(true)
    expect(validateWord('Baum-', 'b', []).reason).toBe('zeichen')
    expect(validateWord('-Baum', 'b', []).reason).toBe('zeichen')
    expect(validateWord('Baum--Haus', 'b', []).reason).toBe('zeichen')
  })

  it('rejects digits and other stray characters', () => {
    expect(validateWord('Haus2', 'h', []).reason).toBe('zeichen')
    expect(validateWord('4711', null, []).reason).toBe('zeichen')
    expect(validateWord('Haus Baum', 'h', []).reason).toBe('zeichen')
    expect(validateWord('Haus!', 'h', []).reason).toBe('zeichen')
  })

  it('trims whitespace before it judges anything', () => {
    const check = validateWord('   Baum   ', 'b', [])
    expect(check.ok).toBe(true)
    expect(check.word).toBe('Baum')
    expect(check.key).toBe('baum')
    expect(validateWord('  baum ', 'b', ['   Baum  ']).reason).toBe('doppelt')
    expect(validateWord('   ', 'b', []).reason).toBe('leer')
    expect(validateWord('', 'b', []).reason).toBe('leer')
  })

  it('accepts a word built from the generated prompt and refuses the neighbour letter', () => {
    const runs = propertyRuns()
    for (let i = 0; i < runs; i++) {
      const trial = generateWortfluss((i % 3) + 1, createRng(i * 31 + 5))
      const letter = (trial.payload as WortflussPayload).letter
      if (letter === null) continue
      const good = `${letter}esen`
      expect(validateWord(good, letter, []).ok).toBe(true)
      expect(validateWord(good, letter, [good]).reason).toBe('doppelt')
      const other = LETTERS[(LETTERS.indexOf(letter) + 1) % LETTERS.length]!
      expect(validateWord(`${other}esen`, letter, []).reason).toBe('buchstabe')
    }
  })
})

describe('wortfluss scoring', () => {
  const result = (word: string, difficulty: number, rtMs = 2000, correct = true): TrialResult => ({
    idx: 0,
    itemType: 'buchstabe',
    difficulty,
    params: {},
    response: word,
    correct,
    rtMs,
    presentedAt: 0,
  })

  it('counts accepted words per minute', () => {
    const score = definition.score(
      [result('Baum', 1), result('Birne', 1), result('Blume', 1)],
      60,
    )
    expect(score.raw).toBe(3)
    expect(score.metrics.accepted).toBe(3)
    expect(score.metrics.uniqueCount).toBe(3)
    expect(score.metrics.rejected).toBe(0)
    expect(score.metrics.meanRtMs).toBe(2000)
    expect(score.accuracy).toBe(1)
  })

  it('pays more for the harder prompt kinds', () => {
    const easy = definition.score([result('Baum', 1), result('Birne', 1)], 60)
    const hard = definition.score([result('Baum', 3), result('Birne', 3)], 60)
    expect(hard.raw).toBeGreaterThan(easy.raw)
    expect(hard.raw / easy.raw).toBeCloseTo(1.6, 10)
  })

  it('counts a repeated word only once as unique', () => {
    const score = definition.score([result('Baum', 1), result('baum', 1)], 60)
    expect(score.metrics.accepted).toBe(2)
    expect(score.metrics.uniqueCount).toBe(1)
  })

  it('reports zero for an empty session without throwing', () => {
    const score = definition.score([], 60)
    expect(score.raw).toBe(0)
    expect(score.accuracy).toBe(0)
    expect(score.metrics.accepted).toBe(0)
    expect(score.metrics.meanRtMs).toBe(0)
  })

  it('treats any non empty word as accepted and an empty one as not', () => {
    const trial = generateWortfluss(1, createRng(42))
    expect(definition.isCorrect!(trial, 'Baum')).toBe(true)
    expect(definition.isCorrect!(trial, '   ')).toBe(false)
    expect(definition.isCorrect!(trial, '')).toBe(false)
    expect(definition.isCorrect!(trial, 7)).toBe(false)
  })
})
