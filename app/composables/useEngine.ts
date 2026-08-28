import { computed, reactive, readonly, ref, shallowRef } from 'vue'
import { createRng } from '~~/shared/rng'
import { isTrialBlock, type GameDefinition, type JsonValue, type RawScore, type Trial, type TrialResult } from '~~/shared/types'
import { applyStaircase, createStaircase, type StaircaseState } from '~~/shared/adaptive'

export type EngineStatus = 'idle' | 'running' | 'finished'

export interface EngineOptions {
  definition: GameDefinition
  seed: number
  startDifficulty?: number
  durationS?: number
  itemCount?: number
  feedbackMs?: number
}

export interface Feedback {
  correct: boolean
  expected: JsonValue
  received: JsonValue
}

const SPAN_TRIALS_PER_LENGTH = 2
const SPAN_FAILURES_TO_STOP = 2

function defaultIsCorrect(trial: Trial, response: JsonValue): boolean {
  if (trial.correctIndex !== undefined) return response === trial.correctIndex
  if (typeof trial.answer === 'number') {
    const numeric = typeof response === 'number' ? response : Number(response)
    return Number.isFinite(numeric) && numeric === trial.answer
  }
  if (typeof trial.answer === 'string') {
    return String(response).trim().toLocaleLowerCase('de-CH') === trial.answer.trim().toLocaleLowerCase('de-CH')
  }
  return JSON.stringify(response) === JSON.stringify(trial.answer)
}

export function useEngine(options: EngineOptions) {
  const { definition } = options
  const durationS = options.durationS ?? definition.defaultDurationS
  const itemCount = options.itemCount ?? definition.itemCount ?? 0
  const feedbackMs = options.feedbackMs ?? 320

  const status = ref<EngineStatus>('idle')
  const current = shallowRef<Trial | null>(null)
  const queue = shallowRef<Trial[]>([])
  const results = reactive<TrialResult[]>([])
  const feedback = ref<Feedback | null>(null)
  const elapsedMs = ref(0)
  const outcome = shallowRef<(RawScore & { durationS: number }) | null>(null)

  const rng = createRng(options.seed)
  const [lo, hi] = definition.difficultyRange
  const staircase = ref<StaircaseState>(
    createStaircase(Math.min(hi, Math.max(lo, options.startDifficulty ?? lo))),
  )
  const difficultyHistory: number[] = []

  const spanFailuresAtLength = ref(0)
  const spanTrialsAtLength = ref(0)
  const spanCorrectAtLength = ref(0)

  let perfStart = 0
  let wallStart = 0
  let presentedAtPerf = 0
  let rafHandle = 0
  let deadlineTimer: ReturnType<typeof setTimeout> | null = null
  let feedbackTimer: ReturnType<typeof setTimeout> | null = null

  const remainingMs = computed(() =>
    definition.mode === 'sprint' ? Math.max(0, durationS * 1000 - elapsedMs.value) : 0,
  )
  const index = computed(() => results.length)
  const total = computed(() => (definition.mode === 'block' ? itemCount : 0))
  const difficulty = computed(() => staircase.value.difficulty)
  const accuracy = computed(() =>
    results.length === 0 ? 0 : results.filter((r) => r.correct).length / results.length,
  )

  function now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now()
  }

  function syncElapsed(): number {
    elapsedMs.value = now() - perfStart
    return elapsedMs.value
  }

  function deadlineReached(): boolean {
    return definition.mode === 'sprint' && syncElapsed() >= durationS * 1000
  }

  function tick() {
    if (deadlineReached()) {
      finish()
      return
    }
    rafHandle = requestAnimationFrame(tick)
  }

  function scheduleDeadline() {
    if (definition.mode !== 'sprint') return
    if (deadlineTimer) clearTimeout(deadlineTimer)
    const remaining = Math.max(0, durationS * 1000 - (now() - perfStart))
    deadlineTimer = setTimeout(() => {
      if (deadlineReached()) finish()
      else scheduleDeadline()
    }, remaining + 20)
  }

  function onVisibilityChange() {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return
    if (status.value !== 'running') return
    if (deadlineReached()) {
      finish()
      return
    }
    scheduleDeadline()
    if (!rafHandle) rafHandle = requestAnimationFrame(tick)
  }

  function nextTrial() {
    if (queue.value.length > 0) {
      const [head, ...rest] = queue.value
      queue.value = rest
      current.value = head!
      presentedAtPerf = now()
      return
    }
    const generated = definition.generate(difficulty.value, rng)
    if (isTrialBlock(generated)) {
      const [head, ...rest] = generated.trials
      queue.value = rest
      current.value = head!
    } else {
      current.value = generated
    }
    presentedAtPerf = now()
  }

  function start() {
    if (status.value === 'running') return
    status.value = 'running'
    perfStart = now()
    wallStart = Date.now()
    elapsedMs.value = 0
    results.length = 0
    outcome.value = null
    feedback.value = null
    nextTrial()
    if (definition.mode === 'sprint') {
      rafHandle = requestAnimationFrame(tick)
      scheduleDeadline()
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }
  }

  function advanceSpan(correct: boolean) {
    spanTrialsAtLength.value++
    if (correct) spanCorrectAtLength.value++

    if (spanTrialsAtLength.value < SPAN_TRIALS_PER_LENGTH) return true

    if (spanCorrectAtLength.value === 0) {
      spanFailuresAtLength.value++
    } else {
      spanFailuresAtLength.value = 0
      staircase.value = {
        difficulty: Math.min(hi, staircase.value.difficulty + 1),
        correctStreak: 0,
      }
    }

    spanTrialsAtLength.value = 0
    spanCorrectAtLength.value = 0
    return spanFailuresAtLength.value < SPAN_FAILURES_TO_STOP
  }

  function record(trial: Trial, response: JsonValue, correct: boolean, rtMs: number) {
    results.push({
      idx: results.length,
      itemType: trial.itemType,
      difficulty: trial.difficulty,
      params: trial.params,
      response,
      correct,
      rtMs: Math.round(rtMs),
      presentedAt: Math.round(wallStart + (presentedAtPerf - perfStart)),
    })
    difficultyHistory.push(trial.difficulty)
  }

  function submit(response: JsonValue) {
    if (status.value !== 'running' || !current.value) return
    const trial = current.value
    const rtMs = now() - presentedAtPerf
    const check = definition.isCorrect ?? defaultIsCorrect
    const correct = check(trial, response)

    record(trial, response, correct, rtMs)
    feedback.value = { correct, expected: trial.answer as JsonValue, received: response }

    let keepGoing = true
    if (definition.mode === 'span') {
      keepGoing = advanceSpan(correct)
    } else {
      staircase.value = applyStaircase(staircase.value, correct, { range: definition.difficultyRange })
    }

    if (definition.mode === 'block' && itemCount > 0 && results.length >= itemCount) keepGoing = false

    if (feedbackTimer) clearTimeout(feedbackTimer)
    feedbackTimer = setTimeout(() => {
      feedback.value = null
      if (!keepGoing) {
        finish()
        return
      }
      if (status.value === 'running') nextTrial()
    }, feedbackMs)
  }

  function finish() {
    if (status.value === 'finished') return
    if (rafHandle) cancelAnimationFrame(rafHandle)
    if (feedbackTimer) clearTimeout(feedbackTimer)
    if (deadlineTimer) clearTimeout(deadlineTimer)
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    rafHandle = 0
    feedbackTimer = null
    deadlineTimer = null
    syncElapsed()
    status.value = 'finished'
    current.value = null
    const seconds = Math.max(0.001, elapsedMs.value / 1000)
    outcome.value = { ...definition.score(results.slice(), seconds), durationS: seconds }
  }

  function dispose() {
    if (rafHandle) cancelAnimationFrame(rafHandle)
    if (feedbackTimer) clearTimeout(feedbackTimer)
    if (deadlineTimer) clearTimeout(deadlineTimer)
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }

  return {
    status: readonly(status),
    current,
    feedback: readonly(feedback),
    results: readonly(results),
    outcome,
    elapsedMs: readonly(elapsedMs),
    remainingMs,
    index,
    total,
    difficulty,
    accuracy,
    difficultyHistory,
    seed: options.seed,
    durationS,
    start,
    submit,
    finish,
    dispose,
  }
}

export type Engine = ReturnType<typeof useEngine>
