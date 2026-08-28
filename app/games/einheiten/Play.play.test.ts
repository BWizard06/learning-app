import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { useEngine } from '~~/app/composables/useEngine'
import { useGameSession } from '~~/app/composables/useGameSession'
import NumberPad from '~~/app/components/NumberPad.vue'
import { createRng } from '~~/shared/rng'
import { generateUmrechnung } from './generator'
import Play from './Play.vue'

const globals = globalThis as unknown as Record<string, unknown>
globals.useEngine = useEngine
globals.useGameSession = useGameSession

const stubs = { GameFrame: { template: '<div class="frame-stub"><slot /></div>' } }

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function open(seed: number) {
  return mount(Play, {
    props: { seed, difficulty: 1, durationS: 30 },
    global: { stubs, components: { NumberPad } },
    attachTo: document.body,
  })
}

function firstTrial(seed: number) {
  return generateUmrechnung(1, createRng(seed))
}

function press(wrapper: ReturnType<typeof open>, text: string) {
  const key = wrapper.findAll('button').find((button) => button.text() === text)
  if (!key) throw new Error(`Taste ${text} fehlt`)
  return key.trigger('click')
}

async function type(wrapper: ReturnType<typeof open>, value: string) {
  for (const character of value) await press(wrapper, character)
}

describe('einheiten play surface', () => {
  it('renders one status region, the task and the unit of the answer', async () => {
    const wrapper = open(11)
    await wrapper.vm.$nextTick()
    const trial = firstTrial(11)

    expect(wrapper.findAll('[role="status"]').length).toBe(1)
    expect(wrapper.find('.run__text').text()).toBe(trial.payload.prompt)
    expect(wrapper.find('.run__unit').text()).toBe(trial.payload.suffix)
    expect(wrapper.find('.eyebrow').text()).toBe(trial.payload.label)
    expect(wrapper.html()).toContain('Prüfen')
    expect(wrapper.html()).not.toContain('ß')

    wrapper.unmount()
  })

  it('accepts the right answer through the number pad', async () => {
    const wrapper = open(23)
    await wrapper.vm.$nextTick()
    const trial = firstTrial(23)

    await type(wrapper, String(trial.answer))
    expect(wrapper.find('.run__value').text()).toBe(String(trial.answer))

    await press(wrapper, 'Prüfen')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="status"]').text()).toContain('richtig')
    expect(wrapper.find('.run__answer').classes()).toContain('is-correct')

    await wait(500)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.run__value').text()).toBe('·')

    wrapper.unmount()
  })

  it('names the expected value with its unit after a wrong answer', async () => {
    const wrapper = open(37)
    await wrapper.vm.$nextTick()
    const trial = firstTrial(37)

    await type(wrapper, `${trial.answer}1`)
    await press(wrapper, 'Prüfen')
    await wrapper.vm.$nextTick()

    const status = wrapper.find('[role="status"]').text()
    expect(status).toContain('richtig wäre')
    expect(status).toContain(String(trial.answer))
    expect(status).toContain(trial.payload.suffix)
    expect(wrapper.find('.run__answer').classes()).toContain('is-wrong')

    wrapper.unmount()
  })

  it('ignores a held key instead of answering by itself', async () => {
    const wrapper = open(53)
    await wrapper.vm.$nextTick()

    for (let i = 0; i < 20; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '5', repeat: true, bubbles: true }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true }))
    }
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.run__value').text()).toBe('·')
    expect(wrapper.find('[role="status"]').text().trim()).toBe('')

    wrapper.unmount()
  })
})
