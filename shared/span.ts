export const SPAN_TRIALS_PER_LENGTH = 2
export const SPAN_FAILURES_TO_STOP = 2

export interface SpanState {
  length: number
  trialsAtLength: number
  correctAtLength: number
  failedLengths: number
  reached: number
  finished: boolean
}

export function createSpan(startLength: number): SpanState {
  return {
    length: startLength,
    trialsAtLength: 0,
    correctAtLength: 0,
    failedLengths: 0,
    reached: 0,
    finished: false,
  }
}

export function advanceSpan(state: SpanState, correct: boolean, maxLength: number): SpanState {
  if (state.finished) return state

  const trialsAtLength = state.trialsAtLength + 1
  const correctAtLength = state.correctAtLength + (correct ? 1 : 0)
  const reached = correct ? Math.max(state.reached, state.length) : state.reached

  if (trialsAtLength < SPAN_TRIALS_PER_LENGTH) {
    return { ...state, trialsAtLength, correctAtLength, reached }
  }

  if (correctAtLength === 0) {
    const failedLengths = state.failedLengths + 1
    return {
      ...state,
      trialsAtLength: 0,
      correctAtLength: 0,
      failedLengths,
      reached,
      finished: failedLengths >= SPAN_FAILURES_TO_STOP,
    }
  }

  const nextLength = Math.min(maxLength, state.length + 1)
  return {
    ...state,
    length: nextLength,
    trialsAtLength: 0,
    correctAtLength: 0,
    failedLengths: 0,
    reached,
    finished: nextLength === state.length,
  }
}
