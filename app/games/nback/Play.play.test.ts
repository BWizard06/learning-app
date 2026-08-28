import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { useEngine } from '~~/app/composables/useEngine'
import { useGameSession } from '~~/app/composables/useGameSession'
import { durationMsFor } from './generator'
import Play from './Play.vue'

const globals = globalThis as unknown as Record<string, unknown>
globals.useEngine = useEngine
globals.useGameSession = useGameSession

const stubs = { GameFrame: { template: '<div class="frame-stub"><slot /></div>' } }

const VISUELL_SEED = 18
const VERBAL_SEED = 7
const DUAL_SEED = 2

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

let ticker: ReturnType<typeof setInterval> | null = null

afterEach(() => {
  if (ticker) clearInterval(ticker)
  ticker = null
})

async function run(
  seed: number,
  durationS: number,
  driver?: () => void,
): Promise<{ payload: any; wrapper: any }> {
  const wrapper = mount(Play, {
    props: { seed, difficulty: 4, durationS },
    global: { stubs },
    attachTo: document.body,
  })
  await wrapper.vm.$nextTick()
  if (driver) ticker = setInterval(driver, 25)
  await wait(durationS * 1000 + 800)
  if (ticker) clearInterval(ticker)
  ticker = null
  await wrapper.vm.$nextTick()
  const events = wrapper.emitted('finish')
  return { payload: events ? (events[0] as any[])[0] : null, wrapper }
}

async function render(seed: number) {
  const wrapper = mount(Play, {
    props: { seed, difficulty: 3, durationS: 30 },
    global: { stubs },
    attachTo: document.body,
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

describe('nback play surface', () => {
  it('shows one status region and a single hit button for the visual stream', async () => {
    const wrapper = await render(VISUELL_SEED)

    expect(wrapper.findAll('[role="status"]').length).toBe(1)
    expect(wrapper.findAll('.grid__cell').length).toBe(9)
    expect(wrapper.html()).toContain('Tippe, wenn das Feld gleich ist wie vor 3 Schritten.')

    const keys = wrapper.findAll('.foot__key')
    expect(keys.length).toBe(1)
    expect(keys[0]!.text()).toBe('Treffer')

    wrapper.unmount()
  })

  it('shows a bare letter and no grid for the verbal stream', async () => {
    const wrapper = await render(VERBAL_SEED)

    expect(wrapper.findAll('.grid__cell').length).toBe(0)
    expect(wrapper.find('.stage__letter').text().length).toBe(1)
    expect(wrapper.html()).toContain('Tippe, wenn der Buchstabe gleich ist wie vor 3 Schritten.')
    expect(wrapper.findAll('.foot__key').length).toBe(1)

    wrapper.unmount()
  })

  it('shows two separate buttons and a letter inside the grid for the dual stream', async () => {
    const wrapper = await render(DUAL_SEED)

    expect(wrapper.findAll('.grid__cell').length).toBe(9)
    expect(wrapper.find('.grid__letter').text().length).toBe(1)

    const keys = wrapper.findAll('.foot__key')
    expect(keys.length).toBe(2)
    expect(keys.map((key) => key.text())).toEqual(['Position', 'Buchstabe'])

    wrapper.unmount()
  })

  it('submits nothing on its own and books the missed matches', async () => {
    const { payload, wrapper } = await run(VISUELL_SEED, 11)

    expect(payload).not.toBeNull()
    expect(payload.trials.length).toBeGreaterThan(4)
    for (const trial of payload.trials) expect(trial.response).toBeNull()

    expect(payload.metrics.treffer).toBe(0)
    expect(payload.metrics.falscheAlarme).toBe(0)
    expect(payload.metrics.verpasst).toBeGreaterThan(0)
    expect(payload.metrics.nLevel).toBe(4)
    expect(payload.rawScore).toBe(0)

    wrapper.unmount()
  })

  it('holds the stimulus for the window that belongs to the n level', async () => {
    const { payload, wrapper } = await run(VISUELL_SEED, 6)
    const expected = durationMsFor(4)

    for (const trial of payload.trials) {
      expect(trial.rtMs).toBeGreaterThanOrEqual(expected - 60)
      expect(trial.rtMs).toBeLessThanOrEqual(expected + 120)
    }

    wrapper.unmount()
  })

  it('books hits and false alarms when the button is pressed on every stimulus', async () => {
    const { payload, wrapper } = await run(VISUELL_SEED, 11, () => {
      for (const node of document.querySelectorAll('.foot__key')) {
        const button = node as HTMLButtonElement
        if (!button.disabled) button.click()
      }
    })

    expect(payload.metrics.treffer).toBeGreaterThan(0)
    expect(payload.metrics.falscheAlarme).toBeGreaterThan(0)
    expect(payload.metrics.verpasst).toBe(0)
    expect(payload.metrics.medianRtMs).toBeGreaterThan(0)

    wrapper.unmount()
  })

  it('answers with the space key but ignores a key that is held down', async () => {
    const tapped = await run(VERBAL_SEED, 11, () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    })
    expect(tapped.payload.metrics.treffer).toBeGreaterThan(0)
    tapped.wrapper.unmount()

    const held = await run(VERBAL_SEED, 11, () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true, bubbles: true }))
    })
    expect(held.payload.metrics.treffer).toBe(0)
    expect(held.payload.metrics.falscheAlarme).toBe(0)
    held.wrapper.unmount()
  })
})
