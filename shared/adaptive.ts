export interface StaircaseState {
  difficulty: number
  correctStreak: number
}

export interface StaircaseOptions {
  range: readonly [number, number]
  stepUp?: number
  stepDown?: number
  runsToStepUp?: number
}

export const DEFAULT_STEP_UP = 1
export const DEFAULT_STEP_DOWN = 1
export const DEFAULT_RUNS_TO_STEP_UP = 2

export function createStaircase(difficulty: number): StaircaseState {
  return { difficulty, correctStreak: 0 }
}

export function applyStaircase(
  state: StaircaseState,
  correct: boolean,
  options: StaircaseOptions,
): StaircaseState {
  const [lo, hi] = options.range
  const stepUp = options.stepUp ?? DEFAULT_STEP_UP
  const stepDown = options.stepDown ?? DEFAULT_STEP_DOWN
  const runsToStepUp = options.runsToStepUp ?? DEFAULT_RUNS_TO_STEP_UP

  if (!correct) {
    return {
      difficulty: Math.max(lo, state.difficulty - stepDown),
      correctStreak: 0,
    }
  }

  const streak = state.correctStreak + 1
  if (streak < runsToStepUp) {
    return { difficulty: state.difficulty, correctStreak: streak }
  }
  return {
    difficulty: Math.min(hi, state.difficulty + stepUp),
    correctStreak: 0,
  }
}

export function settledDifficulty(history: readonly number[], tailFraction = 0.5): number {
  if (history.length === 0) return 0
  const start = Math.floor(history.length * (1 - tailFraction))
  const tail = history.slice(start)
  return tail.reduce((sum, d) => sum + d, 0) / tail.length
}
