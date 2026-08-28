import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { useEngine } from '~~/app/composables/useEngine'
import { useGameSession } from '~~/app/composables/useGameSession'
import ChoiceGrid from '~~/app/components/ChoiceGrid.vue'
import { createRng } from '~~/shared/rng'
import { OPTION_COUNT, generateEstimate } from './generator'
import Play from './Play.vue'

const globals = globalThis as unknown as Record<string, unknown>
globals.useEngine = useEngine
globals.useGameSession = useGameSession

const stubs = { GameFrame: { template: '<div class="frame-stub"><slot /></div>' } }

const SHARP_S = String.fromCharCode(223)

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function open(seed: number) {
  return mount(Play, {
    props: { seed, difficulty: 1, durationS: 30 },
    global: { stubs, components: { ChoiceGrid } },
    attachTo: document.body,
  })
}

function firstTrial(seed: number) {
  return generateEstimate(1, createRng(seed))
}

describe('ueberschlag play surface', () => {
  it('renders one status region, the calculation and five proposals', async () => {
    const wrapper = open(23)
    await wrapper.vm.$nextTick()
    const trial = firstTrial(23)

    expect(wrapper.findAll('[role="status"]').length).toBe(1)
    expect(wrapper.find('.run__expression').text()).toBe(trial.payload.expression)
    expect(wrapper.find('.eyebrow').text()).toBe(trial.payload.question)

    const choices = wrapper.findAll('.choice')
    expect(choices).toHaveLength(OPTION_COUNT)
    expect(choices.map((choice) => choice.text().slice(1))).toEqual(
      trial.options!.map((option) => option.label),
    )
    expect(wrapper.html()).not.toContain(SHARP_S)

    wrapper.unmount()
  })

  it('confirms the right proposal in the status region', async () => {
    const wrapper = open(41)
    await wrapper.vm.$nextTick()
    const trial = firstTrial(41)

    await wrapper.findAll('.choice')[trial.correctIndex!]!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="status"]').text()).toContain('richtig')
    expect(wrapper.findAll('.choice')[trial.correctIndex!]!.classes()).toContain('is-correct')

    await wait(500)
    wrapper.unmount()
  })

  it('names the right value after a wrong proposal', async () => {
    const wrapper = open(59)
    await wrapper.vm.$nextTick()
    const trial = firstTrial(59)
    const wrong = (trial.correctIndex! + 1) % OPTION_COUNT

    await wrapper.findAll('.choice')[wrong]!.trigger('click')
    await wrapper.vm.$nextTick()

    const status = wrapper.find('[role="status"]').text()
    expect(status).toContain('richtig wäre')
    expect(status).toContain(trial.options![trial.correctIndex!]!.label)
    expect(wrapper.findAll('.choice')[wrong]!.classes()).toContain('is-wrong')

    await wait(500)
    wrapper.unmount()
  })

  it('reports a session with the mistake metrics it collected', async () => {
    const wrapper = mount(Play, {
      props: { seed: 77, difficulty: 1, durationS: 2 },
      global: { stubs, components: { ChoiceGrid } },
      attachTo: document.body,
    })
    await wrapper.vm.$nextTick()

    const trial = firstTrial(77)
    const wrong = (trial.correctIndex! + 1) % OPTION_COUNT
    await wrapper.findAll('.choice')[wrong]!.trigger('click')

    await wait(2400)
    const events = wrapper.emitted('finish')
    expect(events).toBeTruthy()

    const payload = (events![0] as unknown[])[0] as {
      metrics: Record<string, number>
      trials: unknown[]
    }
    expect(payload.trials.length).toBeGreaterThan(0)
    for (const key of ['zehnerfehler', 'kommafehler', 'knappfehler', 'umkehrfehler']) {
      expect(payload.metrics[key], key).toBeTypeOf('number')
    }
    const wrongKind =
      payload.metrics.zehnerfehler! +
      payload.metrics.kommafehler! +
      payload.metrics.knappfehler! +
      payload.metrics.umkehrfehler!
    expect(wrongKind).toBeGreaterThan(0)

    wrapper.unmount()
  })
})
