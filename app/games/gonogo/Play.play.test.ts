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

async function run(
  seed: number,
  durationS: number,
  driver?: () => void,
): Promise<{ payload: any; wrapper: any }> {
  const wrapper = mount(Play, {
    props: { seed, difficulty: 1, durationS },
    global: { stubs },
    attachTo: document.body,
  })
  await wrapper.vm.$nextTick()
  if (driver) ticker = setInterval(driver, 25)
  await wait(durationS * 1000 + 900)
  if (ticker) clearInterval(ticker)
  ticker = null
  await wrapper.vm.$nextTick()
  const events = wrapper.emitted('finish')
  return { payload: events ? (events[0] as any[])[0] : null, wrapper }
}

describe('gonogo play surface', () => {
  it('renders one status region and a stimulus picture', async () => {
    const wrapper = mount(Play, {
      props: { seed: 7, difficulty: 1, durationS: 2 },
      global: { stubs },
      attachTo: document.body,
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[role="status"]').length).toBe(1)
    expect(wrapper.html()).toContain('Tippe bei jedem Buchstaben, nur beim X nicht.')
    expect(wrapper.html()).toContain('<svg')
    expect(wrapper.find('button').text()).toBe('Tippen')

    wrapper.unmount()
  })

  it('submits null on its own when nobody taps', async () => {
    const { payload, wrapper } = await run(101, 3)
    expect(payload).not.toBeNull()
    expect(payload.trials.length).toBeGreaterThan(1)
    for (const trial of payload.trials) {
      expect(trial.response).toBeNull()
    }
    expect(payload.metrics.goTreffer).toBe(0)
    expect(payload.metrics.kommissionsfehler).toBe(0)
    expect(payload.metrics.omissionsfehler + payload.metrics.nogoTreffer).toBe(
      payload.metrics.reize,
    )
    for (const key of [
      'kommissionsfehler',
      'omissionsfehler',
      'goTreffer',
      'nogoTreffer',
      'medianRtMs',
      'rtVariabilitaet',
    ]) {
      expect(payload.metrics, key).toHaveProperty(key)
    }
    wrapper.unmount()
  })

  it('registers a tap on the big button', async () => {
    const { payload, wrapper } = await run(202, 3, () => {
      const button = document.querySelector('.foot__go') as HTMLButtonElement | null
      if (button && !button.disabled) button.click()
    })
    expect(payload.metrics.goTreffer).toBeGreaterThan(0)
    expect(payload.metrics.omissionsfehler).toBe(0)
    expect(payload.trials.some((trial: any) => trial.response === true)).toBe(true)
    expect(payload.metrics.medianRtMs).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('answers with the space key but ignores a held key', async () => {
    const tapped = await run(303, 3, () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    })
    expect(tapped.payload.metrics.goTreffer).toBeGreaterThan(0)
    tapped.wrapper.unmount()

    const held = await run(303, 3, () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true, bubbles: true }))
    })
    expect(held.payload.metrics.goTreffer).toBe(0)
    expect(held.payload.metrics.kommissionsfehler).toBe(0)
    held.wrapper.unmount()
  })

  it('keeps the presentation window close to the difficulty setting', async () => {
    const { payload, wrapper } = await run(404, 4)
    const gaps: number[] = payload.trials.map((trial: any) => trial.rtMs)
    const worst = Math.max(...gaps)
    const best = Math.min(...gaps)
    expect(best).toBeGreaterThanOrEqual(880)
    expect(worst).toBeLessThanOrEqual(960)
    wrapper.unmount()
  })
})
