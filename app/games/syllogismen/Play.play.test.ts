import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { useEngine } from '~~/app/composables/useEngine'
import { useGameSession } from '~~/app/composables/useGameSession'
import { createRng } from '~~/shared/rng'
import { VERDICTS, VERDICT_LABELS, generateSyllogism, type Verdict } from './generator'
import Play from './Play.vue'

const globals = globalThis as unknown as Record<string, unknown>
globals.useEngine = useEngine
globals.useGameSession = useGameSession

const stubs = { GameFrame: { template: '<div class="frame-stub"><slot /></div>' } }

const SHARP_S = String.fromCharCode(223)

function open(seed: number) {
  return mount(Play, {
    props: { seed, difficulty: 1, durationS: 30 },
    global: { stubs },
    attachTo: document.body,
  })
}

function firstTrial(seed: number) {
  return generateSyllogism(1, createRng(seed))
}

function press(wrapper: ReturnType<typeof open>, verdict: Verdict) {
  const key = wrapper
    .findAll('button')
    .find((button) => button.text().includes(VERDICT_LABELS[verdict]))
  if (!key) throw new Error(`Taste ${verdict} fehlt`)
  return key.trigger('click')
}

function otherVerdict(verdict: Verdict): Verdict {
  return VERDICTS.find((entry) => entry !== verdict)!
}

describe('syllogismen play surface', () => {
  it('renders one status region, both premises and the conclusion', async () => {
    const wrapper = open(11)
    await wrapper.vm.$nextTick()
    const trial = firstTrial(11)

    expect(wrapper.findAll('[role="status"]').length).toBe(1)
    const sentences = wrapper.findAll('.run__sentence').map((node) => node.text())
    expect(sentences).toEqual([...trial.payload.premises, trial.payload.conclusion])
    expect(wrapper.findAll('.keys__key').length).toBe(3)
    for (const verdict of VERDICTS) {
      expect(wrapper.html()).toContain(VERDICT_LABELS[verdict])
    }
    expect(wrapper.html()).not.toContain(SHARP_S)

    wrapper.unmount()
  })

  it('marks the chosen key after a correct answer', async () => {
    const wrapper = open(23)
    await wrapper.vm.$nextTick()
    const trial = firstTrial(23)

    await press(wrapper, trial.answer)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="status"]').text()).toContain('richtig')
    expect(wrapper.find('.run__card').classes()).toContain('is-correct')
    const marked = wrapper.findAll('.keys__key').filter((key) => key.classes().includes('is-correct'))
    expect(marked.length).toBe(1)
    expect(marked[0]!.text()).toContain(VERDICT_LABELS[trial.answer])

    wrapper.unmount()
  })

  it('names the expected category after a wrong answer', async () => {
    const wrapper = open(37)
    await wrapper.vm.$nextTick()
    const trial = firstTrial(37)

    await press(wrapper, otherVerdict(trial.answer))
    await wrapper.vm.$nextTick()

    const status = wrapper.find('[role="status"]').text()
    expect(status).toContain('richtig wäre')
    expect(status).toContain(VERDICT_LABELS[trial.answer])
    expect(wrapper.find('.run__card').classes()).toContain('is-wrong')

    wrapper.unmount()
  })

  it('ignores a held key instead of answering by itself', async () => {
    const wrapper = open(53)
    await wrapper.vm.$nextTick()

    for (let i = 0; i < 20; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', repeat: true, bubbles: true }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', repeat: true, bubbles: true }))
    }
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="status"]').text().trim()).toBe('')

    wrapper.unmount()
  })

  it('answers through the number keys of a desktop keyboard', async () => {
    const wrapper = open(67)
    await wrapper.vm.$nextTick()
    const trial = firstTrial(67)
    const position = VERDICTS.indexOf(trial.answer) + 1

    window.dispatchEvent(new KeyboardEvent('keydown', { key: String(position), bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="status"]').text()).toContain('✓ richtig')

    wrapper.unmount()
  })
})
