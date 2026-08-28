import type { Rng } from '~~/shared/rng'
import type { Trial } from '~~/shared/types'

export const ITEM_TYPES = ['buchstabe', 'kategorie', 'kombiniert'] as const

export type ItemType = (typeof ITEM_TYPES)[number]

export interface WortflussPayload {
  letter: string | null
  category: string | null
  prompt: string
}

export type WortflussTrial = Trial<WortflussPayload, null>

export const LETTERS: readonly string[] = [
  'a',
  'b',
  'd',
  'e',
  'f',
  'g',
  'h',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'z',
]

export const CATEGORIES: readonly string[] = [
  'Tiere',
  'Pflanzen',
  'Berufe',
  'Länder',
  'Städte',
  'Flüsse',
  'Speisen',
  'Getränke',
  'Früchte',
  'Gemüse',
  'Körperteile',
  'Kleidungsstücke',
  'Möbel',
  'Werkzeuge',
  'Fahrzeuge',
  'Musikinstrumente',
  'Sportarten',
  'Farben',
  'Blumen',
  'Bäume',
  'Vögel',
  'Fische',
  'Metalle',
  'Schulfächer',
  'Gefühle',
  'Gebäude',
  'Haushaltsgeräte',
  'Spielzeuge',
  'Dinge in der Küche',
  'Dinge im Wald',
]

export const MIN_WORD_LENGTH = 3

const WORD_PATTERN = /^[a-zäöüß]+(?:-[a-zäöüß]+)*$/

export type RejectReason = 'leer' | 'zeichen' | 'kurz' | 'buchstabe' | 'doppelt'

export interface WordCheck {
  ok: boolean
  word: string
  key: string
  reason: RejectReason | null
}

export function validateWord(
  raw: string,
  letter: string | null,
  entered: readonly string[],
): WordCheck {
  const word = raw.trim()
  const key = word.toLowerCase()

  if (key.length === 0) return { ok: false, word, key, reason: 'leer' }
  if (!WORD_PATTERN.test(key)) return { ok: false, word, key, reason: 'zeichen' }
  if (key.length < MIN_WORD_LENGTH) return { ok: false, word, key, reason: 'kurz' }
  if (letter !== null && !key.startsWith(letter.trim().toLowerCase())) {
    return { ok: false, word, key, reason: 'buchstabe' }
  }
  if (entered.some((existing) => existing.trim().toLowerCase() === key)) {
    return { ok: false, word, key, reason: 'doppelt' }
  }

  return { ok: true, word, key, reason: null }
}

export function clampDifficulty(difficulty: number): number {
  if (!Number.isFinite(difficulty)) return 1
  return Math.min(3, Math.max(1, Math.round(difficulty)))
}

export function itemTypeFor(difficulty: number): ItemType {
  const level = clampDifficulty(difficulty)
  if (level === 1) return 'buchstabe'
  if (level === 2) return 'kategorie'
  return 'kombiniert'
}

export function generateWortfluss(difficulty: number, rng: Rng): WortflussTrial {
  const level = clampDifficulty(difficulty)
  const itemType = itemTypeFor(level)

  const letterIndex = itemType === 'kategorie' ? null : rng.int(0, LETTERS.length - 1)
  const categoryIndex = itemType === 'buchstabe' ? null : rng.int(0, CATEGORIES.length - 1)

  const letter = letterIndex === null ? null : LETTERS[letterIndex]!
  const category = categoryIndex === null ? null : CATEGORIES[categoryIndex]!
  const upper = letter === null ? '' : letter.toUpperCase()

  let prompt: string
  if (itemType === 'buchstabe') prompt = `Wörter mit ${upper}`
  else if (itemType === 'kategorie') prompt = `Wörter aus der Kategorie ${category}`
  else prompt = `${category} mit ${upper}`

  return {
    itemType,
    difficulty: level,
    params: { type: itemType, letterIndex, categoryIndex },
    payload: { letter, category, prompt },
    answer: null,
  }
}
