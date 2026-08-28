import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NumberPad from '~~/app/components/NumberPad.vue'
import { useEngine } from '~~/app/composables/useEngine'
import { useGameSession } from '~~/app/composables/useGameSession'
import { directionForSeed } from './generator'
import Play from './Play.vue'

const globals = globalThis as unknown as Record<string, unknown>
globals.useEngine = useEngine
globals.useGameSession = useGameSession

const stubs = { GameFrame: { template: '<div class="frame-stub"><slot /></div>' } }

let ticker: ReturnType<typeof setInterval> | null = null

afterEach(() => {
  if (ticker) clearInterval(ticker)
  ticker = null
})

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function until(check: () => boolean, budgetMs: number) {
  const deadline = Date.now() + budgetMs
  while (Date.now() < deadline) {
    if (check()) return true
    await wait(25)
  }
  return check()
}

function press(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

function statusText(): string {
  return (document.querySelector('[role="status"]')?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function open(seed: number, difficulty: number) {
  return mount(Play, {
    props: { seed, difficulty },
    global: { stubs, components: { NumberPad } },
    attachTo: document.body,
  })
}

describe('zahlenspanne play surface', () => {
  it('hides the keys while the digits run and shows exactly one status region', async () => {
    const wrapper = open(8, 3)
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[role="status"]').length).toBe(1)
    expect(wrapper.findAll('[aria-live]').length).toBe(0)
    expect(wrapper.html()).toContain('in gleicher Reihenfolge eintippen')
    expect(wrapper.find('.pad').exists()).toBe(false)
    expect(wrapper.findAll('.run__bead').length).toBe(3)

    await until(() => document.querySelector('.pad') !== null, 8000)
    expect(wrapper.find('.pad').exists()).toBe(true)
    expect(wrapper.find('.run__digit').exists()).toBe(false)

    wrapper.unmount()
  })

  it('accepts the sequence it just showed', async () => {
    const seed = 8
    expect(directionForSeed(seed)).toBe('vorwaerts')

    const wrapper = open(seed, 3)
    await wrapper.vm.$nextTick()

    const seenDigits: string[] = []
    let previous: string | null = null
    ticker = setInterval(() => {
      const element = document.querySelector('.run__digit')
      const text = element ? (element.textContent ?? '').trim() : null
      if (text !== null && text !== previous) seenDigits.push(text)
      previous = text
    }, 20)

    await until(() => document.querySelector('.pad') !== null, 8000)
    if (ticker) clearInterval(ticker)
    ticker = null

    expect(seenDigits.length).toBe(3)

    for (const digit of seenDigits) {
      press(digit)
      await wrapper.vm.$nextTick()
    }
    expect(wrapper.find('.run__entry').text()).toBe(seenDigits.join(''))

    press('Enter')
    await wrapper.vm.$nextTick()
    expect(statusText()).toBe('✓ richtig')

    wrapper.unmount()
  })

  it('ends the session after two failed lengths and reports the span metrics', async () => {
    const wrapper = open(9, 3)
    await wrapper.vm.$nextTick()

    ticker = setInterval(() => {
      const pad = document.querySelector('.pad')
      const entry = document.querySelector('.run__entry')
      if (!pad || !entry) return
      press((entry.textContent ?? '').trim() === '·' ? '1' : 'Enter')
    }, 30)

    const done = await until(() => wrapper.emitted('finish') !== undefined, 28000)
    if (ticker) clearInterval(ticker)
    ticker = null
    expect(done).toBe(true)

    const payload = (wrapper.emitted('finish')![0] as any[])[0]
    expect(payload.rawScore).toBe(0)
    expect(payload.accuracy).toBe(0)
    expect(payload.trials.length).toBe(4)
    expect(payload.metrics.spanne).toBe(0)
    expect(payload.metrics.versuche).toBe(4)
    expect(payload.metrics.korrekt).toBe(0)
    expect(payload.metrics.medianRtMs).toBeGreaterThan(3000)
    expect(payload.metrics.rueckwaertsSpanne).toBe(0)
    expect(payload.metrics).not.toHaveProperty('vorwaertsSpanne')

    wrapper.unmount()
  })
})
