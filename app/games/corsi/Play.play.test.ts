import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { useEngine } from '~~/app/composables/useEngine'
import { useGameSession } from '~~/app/composables/useGameSession'
import Play from './Play.vue'

const globals = globalThis as unknown as Record<string, unknown>
globals.useEngine = useEngine
globals.useGameSession = useGameSession

const stubs = { GameFrame: { template: '<div class="frame-stub"><slot /></div>' } }

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

let ticker: ReturnType<typeof setInterval> | null = null

afterEach(() => {
  if (ticker) clearInterval(ticker)
  ticker = null
})

function blocks(): HTMLButtonElement[] {
  return [...document.querySelectorAll('.board__block')] as HTMLButtonElement[]
}

function promptText(): string {
  return document.querySelector('.run__prompt')?.textContent ?? ''
}

async function run(seed: number, durationS: number, driver?: () => void) {
  const wrapper = mount(Play, {
    props: { seed, difficulty: 2, durationS },
    global: { stubs },
    attachTo: document.body,
  })
  await wrapper.vm.$nextTick()
  if (driver) ticker = setInterval(driver, 20)
  await wait(durationS * 1000 + 700)
  if (ticker) clearInterval(ticker)
  ticker = null
  await wrapper.vm.$nextTick()
  const events = wrapper.emitted('finish')
  const payload = events ? (events[0] as any[])[0] : null
  wrapper.unmount()
  return payload
}

describe('corsi play surface', () => {
  it('shows nine locked blocks, one status region and one prompt', async () => {
    const wrapper = mount(Play, {
      props: { seed: 4711, difficulty: 2, durationS: 30 },
      global: { stubs },
      attachTo: document.body,
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[role="status"]').length).toBe(1)
    expect(wrapper.findAll('.board__block').length).toBe(9)
    expect(promptText().length).toBeGreaterThan(0)
    for (const block of blocks()) {
      expect(block.disabled).toBe(true)
    }

    await wait(500)
    expect(blocks().some((block) => block.classList.contains('is-lit'))).toBe(false)

    await wait(900)
    expect(blocks().filter((block) => block.classList.contains('is-lit')).length).toBeLessThanOrEqual(1)

    wrapper.unmount()
  })

  it('lights the sequence, then accepts it tapped back in the asked direction', async () => {
    let recorded: number[] = []
    let lastLit = -1
    let answered = false
    let longestSeen = 0
    let rounds = 0

    const payload = await run(4711, 11, () => {
      const board = blocks()
      if (board.length === 0) return
      const open = board.every((block) => !block.disabled)

      if (!open) {
        if (answered) {
          recorded = []
          lastLit = -1
          answered = false
        }
        const lit = board.findIndex((block) => block.classList.contains('is-lit'))
        if (lit >= 0 && lit !== lastLit) recorded.push(lit)
        lastLit = lit
        return
      }

      if (answered || recorded.length === 0) return
      longestSeen = Math.max(longestSeen, recorded.length)
      rounds++
      const order = promptText().includes('umgekehrter') ? [...recorded].reverse() : recorded
      for (const index of order) board[index]!.click()
      answered = true
    })

    expect(longestSeen).toBeGreaterThanOrEqual(2)
    expect(rounds).toBeGreaterThanOrEqual(2)
    expect(payload).not.toBeNull()
    expect(payload.trials.length).toBe(rounds)
    expect(payload.accuracy).toBe(1)
    expect(payload.metrics.korrekt).toBe(rounds)
    expect(payload.metrics.spanne).toBeGreaterThanOrEqual(2)
    expect(payload.rawScore).toBe(payload.metrics.spanne)
    for (const key of ['spanne', 'richtung', 'versuche', 'korrekt', 'medianRtMs']) {
      expect(payload.metrics, key).toHaveProperty(key)
    }
  })

  it('answers with the keyboard but ignores a held key', async () => {
    const press = (repeat: boolean) => () => {
      const board = blocks()
      const target = board.find((block) => !block.disabled)
      if (!target) return
      target.focus()
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat, bubbles: true }))
    }

    const typed = await run(90210, 9, press(false))
    expect(typed.trials.length).toBeGreaterThan(0)
    for (const trial of typed.trials) {
      expect(Array.isArray(trial.response)).toBe(true)
      expect(trial.response.length).toBeGreaterThan(0)
    }

    const held = await run(90210, 9, press(true))
    expect(held.trials.length).toBe(0)
    expect(held.metrics.versuche).toBe(0)
    expect(held.metrics.spanne).toBe(0)
  })
})
