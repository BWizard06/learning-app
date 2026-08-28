import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRng } from '~~/shared/rng'
import { useEngine } from '~~/app/composables/useEngine'
import { useGameSession } from '~~/app/composables/useGameSession'
import ChoiceGrid from '~~/app/components/ChoiceGrid.vue'
import { generateFigurenBlock } from './generator'
import Play from './Play.vue'

const globals = globalThis as unknown as Record<string, unknown>
globals.useEngine = useEngine
globals.useGameSession = useGameSession

const stubs = { GameFrame: { template: '<div class="frame-stub"><slot /></div>' } }

const LERNZEIT_MS = 15000
const ABLENKZEIT_MS = 20000
const FEEDBACK_MS = 400

function mountPlay(seed: number) {
  return mount(Play, {
    props: { seed, difficulty: 1, durationS: 300 },
    global: { stubs, components: { ChoiceGrid } },
    attachTo: document.body,
  })
}

async function vorspulen(wrapper: ReturnType<typeof mountPlay>, ms: number) {
  vi.advanceTimersByTime(ms)
  await wrapper.vm.$nextTick()
  await wrapper.vm.$nextTick()
}

afterEach(() => {
  vi.useRealTimers()
})

describe('figurenlernen play surface', () => {
  it('zeigt zuerst die Lernfiguren und genau eine Statusmeldung', async () => {
    vi.useFakeTimers()
    const wrapper = mountPlay(21)
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
    expect(wrapper.find('[role="status"]').text()).toContain('Figur 1 von 3')
    expect(wrapper.findAll('.run__punkt')).toHaveLength(3)
    expect(wrapper.html()).toContain('<svg')
    expect(wrapper.findAll('button.choice')).toHaveLength(0)

    await vorspulen(wrapper, LERNZEIT_MS / 3)
    expect(wrapper.find('[role="status"]').text()).toContain('Figur 2 von 3')

    wrapper.unmount()
  })

  it('schiebt eine Zwischenrechnung zwischen Lernen und Wiedererkennen', async () => {
    vi.useFakeTimers()
    const wrapper = mountPlay(21)
    const satz = generateFigurenBlock(1, createRng(21))
    await wrapper.vm.$nextTick()

    await vorspulen(wrapper, LERNZEIT_MS)
    expect(wrapper.html()).toContain('Zwischenrechnen')
    expect(wrapper.find('[role="status"]').text()).toContain('20 Sekunden')
    expect(wrapper.findAll('button.choice')).toHaveLength(3)
    expect(wrapper.html()).toContain(satz.payload.ablenkung[0]!.text)

    await wrapper.findAll('button.choice')[0]!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.html()).toContain(satz.payload.ablenkung[1]!.text)

    await vorspulen(wrapper, ABLENKZEIT_MS)
    expect(wrapper.html()).toContain('Schon gesehen?')
    const knoepfe = wrapper.findAll('button.choice')
    expect(knoepfe).toHaveLength(2)
    expect(knoepfe[0]!.text()).toContain('Gesehen')
    expect(knoepfe[1]!.text()).toContain('Neu')

    wrapper.unmount()
  })

  it('meldet eine volle korrigierte Rate, wenn jeder Ausschnitt stimmt', async () => {
    vi.useFakeTimers()
    const wrapper = mountPlay(21)
    const satz = generateFigurenBlock(1, createRng(21))
    await wrapper.vm.$nextTick()

    await vorspulen(wrapper, LERNZEIT_MS)
    await vorspulen(wrapper, ABLENKZEIT_MS)

    for (const trial of satz.trials) {
      const knoepfe = wrapper.findAll('button.choice')
      await knoepfe[trial.answer === true ? 0 : 1]!.trigger('click')
      await vorspulen(wrapper, FEEDBACK_MS)
    }

    const events = wrapper.emitted('finish')
    expect(events).toBeTruthy()
    const payload = (events![0] as unknown[])[0] as {
      rawScore: number
      accuracy: number
      metrics: Record<string, number>
      trials: unknown[]
    }

    expect(payload.trials).toHaveLength(6)
    expect(payload.rawScore).toBe(1)
    expect(payload.accuracy).toBe(1)
    expect(payload.metrics.treffer).toBe(3)
    expect(payload.metrics.falscheAlarme).toBe(0)
    expect(payload.metrics.korrigierteRate).toBe(1)
    expect(payload.metrics.anzahlFiguren).toBe(3)
    expect(payload.metrics.lernzeitMs).toBe(LERNZEIT_MS)

    wrapper.unmount()
  })

  it('zaehlt jedes Gesehen auf einem neuen Ausschnitt als Fehlalarm', async () => {
    vi.useFakeTimers()
    const wrapper = mountPlay(21)
    const satz = generateFigurenBlock(1, createRng(21))
    await wrapper.vm.$nextTick()

    await vorspulen(wrapper, LERNZEIT_MS)
    await vorspulen(wrapper, ABLENKZEIT_MS)

    for (let i = 0; i < satz.trials.length; i++) {
      const knoepfe = wrapper.findAll('button.choice')
      await knoepfe[0]!.trigger('click')
      await wrapper.vm.$nextTick()
      if (i === 0) {
        const gemeldet = wrapper.find('[role="status"]').text()
        expect(gemeldet).toContain(satz.trials[0]!.answer === true ? 'richtig' : 'falsch')
      }
      await vorspulen(wrapper, FEEDBACK_MS)
    }

    const events = wrapper.emitted('finish')
    const payload = (events![0] as unknown[])[0] as { rawScore: number; metrics: Record<string, number> }

    expect(payload.metrics.treffer).toBe(3)
    expect(payload.metrics.falscheAlarme).toBe(3)
    expect(payload.rawScore).toBe(0)

    wrapper.unmount()
  })
})
