import { computed, ref } from 'vue'
import { v7 as uuidv7 } from 'uuid'
import { buildExamParts, type ExamPart } from '~~/shared/exam'
import { noteFromThresholds } from '~~/shared/scoring'
import { evaluatePromotion, type PartNotes, type PromotionVerdict } from '~~/shared/promotion'
import type { Construct } from '~~/shared/types'
import { games, gameBySlug } from '~/games'

const STORAGE_KEY = 'learning-app.exam-run'

export interface ExamPartResult {
  construct: Construct
  slug: string
  note: number
  rawScore: number
  accuracy: number
  durationS: number
  seed: number
  finishedAt: number
}

export interface ExamRunState {
  id: string
  startedAt: number
  seed: number
  repeatedSeed: boolean
  partIndex: number
  results: ExamPartResult[]
}

function readStored(): ExamRunState | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ExamRunState
    if (typeof parsed?.id !== 'string' || !Array.isArray(parsed.results)) return null
    return parsed
  } catch {
    return null
  }
}

function persist(state: ExamRunState | null): void {
  if (typeof localStorage === 'undefined') return
  if (state === null) localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function useExamRun() {
  const state = ref<ExamRunState | null>(null)
  const parts = computed<ExamPart[]>(() => buildExamParts(games.map((game) => game.slug)).parts)
  const missing = computed(() => buildExamParts(games.map((game) => game.slug)).missing)

  const currentPart = computed<ExamPart | null>(() => {
    if (!state.value) return null
    return parts.value[state.value.partIndex] ?? null
  })

  const finished = computed(
    () => state.value !== null && state.value.partIndex >= parts.value.length,
  )

  const partNotes = computed<PartNotes>(() => {
    const notes: PartNotes = {}
    for (const result of state.value?.results ?? []) notes[result.construct] = result.note
    return notes
  })

  const verdict = computed<PromotionVerdict | null>(() =>
    state.value === null ? null : evaluatePromotion(partNotes.value),
  )

  function loadResumable(): ExamRunState | null {
    const stored = readStored()
    if (stored && stored.partIndex < parts.value.length) return stored
    return null
  }

  function start(options: { seed?: number } = {}): void {
    const seed = options.seed ?? Math.floor(Math.random() * 0xffffffff)
    state.value = {
      id: uuidv7(),
      startedAt: Date.now(),
      seed,
      repeatedSeed: options.seed !== undefined,
      partIndex: 0,
      results: [],
    }
    persist(state.value)
  }

  function resume(stored: ExamRunState): void {
    state.value = stored
  }

  function partSeed(index: number): number {
    if (!state.value) return 0
    return (state.value.seed + index * 2654435761) >>> 0
  }

  function recordPart(result: Omit<ExamPartResult, 'note' | 'construct' | 'finishedAt'>): void {
    if (!state.value || !currentPart.value) return
    const definition = gameBySlug(result.slug)
    if (!definition) return

    state.value.results.push({
      construct: currentPart.value.construct,
      slug: result.slug,
      note: noteFromThresholds(result.rawScore, definition.thresholds),
      rawScore: result.rawScore,
      accuracy: result.accuracy,
      durationS: result.durationS,
      seed: result.seed,
      finishedAt: Date.now(),
    })
    state.value.partIndex++
    persist(state.value)
  }

  function abandon(): void {
    state.value = null
    persist(null)
  }

  function clearStored(): void {
    persist(null)
  }

  return {
    state,
    parts,
    missing,
    currentPart,
    finished,
    partNotes,
    verdict,
    loadResumable,
    start,
    resume,
    partSeed,
    recordPart,
    abandon,
    clearStored,
  }
}
