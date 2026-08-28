import { describe, expect, it } from 'vitest'
import { createRng } from './rng'
import { applyStaircase, createStaircase, settledDifficulty } from './adaptive'

const range: [number, number] = [1, 20]

function simulate(ability: number, slope: number, trials: number, seed: number) {
  const rng = createRng(seed)
  let state = createStaircase(1)
  const history: number[] = []
  let correctCount = 0
  for (let i = 0; i < trials; i++) {
    const pCorrect = 1 / (1 + Math.exp((state.difficulty - ability) / slope))
    const correct = rng.next() < pCorrect
    if (correct) correctCount++
    history.push(state.difficulty)
    state = applyStaircase(state, correct, { range })
  }
  return { history, accuracy: correctCount / trials, final: state.difficulty }
}

describe('staircase mechanics', () => {
  it('needs two correct answers in a row to step up', () => {
    let state = createStaircase(5)
    state = applyStaircase(state, true, { range })
    expect(state.difficulty).toBe(5)
    state = applyStaircase(state, true, { range })
    expect(state.difficulty).toBe(6)
  })

  it('steps down after a single wrong answer', () => {
    let state = createStaircase(5)
    state = applyStaircase(state, false, { range })
    expect(state.difficulty).toBe(4)
  })

  it('resets the streak on a wrong answer', () => {
    let state = createStaircase(5)
    state = applyStaircase(state, true, { range })
    state = applyStaircase(state, false, { range })
    expect(state.correctStreak).toBe(0)
    state = applyStaircase(state, true, { range })
    expect(state.difficulty).toBe(4)
  })

  it('never leaves the configured range', () => {
    let low = createStaircase(1)
    for (let i = 0; i < 50; i++) low = applyStaircase(low, false, { range })
    expect(low.difficulty).toBe(1)

    let high = createStaircase(20)
    for (let i = 0; i < 50; i++) high = applyStaircase(high, true, { range })
    expect(high.difficulty).toBe(20)
  })
})

describe('convergence of a simulated user', () => {
  it('settles near the ability level rather than drifting', () => {
    const { history } = simulate(12, 1.5, 4000, 42)
    const settled = settledDifficulty(history)
    expect(settled).toBeGreaterThan(9)
    expect(settled).toBeLessThan(14)
  })

  it('holds accuracy in the intended band', () => {
    const { history, accuracy } = simulate(12, 1.5, 4000, 7)
    expect(settledDifficulty(history)).toBeGreaterThan(9)
    expect(accuracy).toBeGreaterThan(0.6)
    expect(accuracy).toBeLessThan(0.8)
  })

  it('separates a weak user from a strong one', () => {
    const weak = settledDifficulty(simulate(4, 1.5, 4000, 11).history)
    const strong = settledDifficulty(simulate(16, 1.5, 4000, 11).history)
    expect(strong - weak).toBeGreaterThan(8)
  })

  it('is stable across seeds', () => {
    const settled = [1, 2, 3, 4, 5].map((seed) => settledDifficulty(simulate(12, 1.5, 3000, seed).history))
    const spread = Math.max(...settled) - Math.min(...settled)
    expect(spread).toBeLessThan(1.5)
  })
})
