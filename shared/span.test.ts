import { describe, expect, it } from 'vitest'
import { advanceSpan, createSpan, SPAN_FAILURES_TO_STOP, SPAN_TRIALS_PER_LENGTH, type SpanState } from './span'

const MAX = 12

function run(answers: readonly boolean[], start = 3, max = MAX): SpanState {
  let state = createSpan(start)
  for (const correct of answers) state = advanceSpan(state, correct, max)
  return state
}

describe('span procedure', () => {
  it('shows two trials per length before deciding', () => {
    expect(SPAN_TRIALS_PER_LENGTH).toBe(2)
    const afterOne = run([true])
    expect(afterOne.length).toBe(3)
    expect(afterOne.trialsAtLength).toBe(1)
  })

  it('grows the length when at least one of the two is right', () => {
    expect(run([true, false]).length).toBe(4)
    expect(run([false, true]).length).toBe(4)
    expect(run([true, true]).length).toBe(4)
  })

  it('does not grow when both are wrong', () => {
    const state = run([false, false])
    expect(state.length).toBe(3)
    expect(state.failedLengths).toBe(1)
    expect(state.finished).toBe(false)
  })

  it('stops after two failed lengths in a row', () => {
    expect(SPAN_FAILURES_TO_STOP).toBe(2)
    const state = run([false, false, false, false])
    expect(state.finished).toBe(true)
  })

  it('resets the failure count after a success, so a single slip does not end the run', () => {
    const state = run([false, false, true, false, false, false])
    expect(state.finished).toBe(false)
    expect(state.failedLengths).toBe(1)
  })

  it('records the highest length actually answered correctly, not the highest attempted', () => {
    const state = run([true, true, true, true, false, false])
    expect(state.length, 'reached length 5 as an attempt').toBe(5)
    expect(state.reached, 'but never solved anything at 5').toBe(4)
  })

  it('records a length as soon as one trial at it is right', () => {
    const state = run([true, true, true, true, true, false])
    expect(state.reached).toBe(5)
  })

  it('never records a length that was only attempted, not solved', () => {
    const state = run([false, false, false, false])
    expect(state.reached).toBe(0)
  })

  it('counts a length as reached from a single correct trial at it', () => {
    const state = run([true, false, false, false, false, false])
    expect(state.reached).toBe(3)
  })

  it('stops at the ceiling instead of growing past it', () => {
    let state = createSpan(11)
    for (let i = 0; i < 20; i++) state = advanceSpan(state, true, 12)
    expect(state.length).toBe(12)
    expect(state.finished).toBe(true)
  })

  it('ignores further answers once finished', () => {
    const finished = run([false, false, false, false])
    const after = advanceSpan(finished, true, MAX)
    expect(after).toEqual(finished)
  })

  it('walks a realistic run to the expected span', () => {
    const state = run([true, true, true, false, false, true, false, false, false, false])
    expect(state.reached).toBe(5)
    expect(state.finished).toBe(true)
  })

  it('never lets the reached span exceed the current length', () => {
    let state = createSpan(3)
    for (let i = 0; i < 200; i++) {
      state = advanceSpan(state, i % 3 !== 0, MAX)
      expect(state.reached).toBeLessThanOrEqual(state.length)
    }
  })

  it('always terminates for a user who fails everything', () => {
    let state = createSpan(3)
    let steps = 0
    while (!state.finished && steps < 100) {
      state = advanceSpan(state, false, MAX)
      steps++
    }
    expect(state.finished).toBe(true)
    expect(steps).toBe(4)
  })

  it('is immutable, it never edits the state it is given', () => {
    const before = createSpan(3)
    const snapshot = { ...before }
    advanceSpan(before, true, MAX)
    expect(before).toEqual(snapshot)
  })
})
