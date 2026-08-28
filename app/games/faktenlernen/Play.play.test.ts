import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRng } from '~~/shared/rng'
import { useEngine } from '~~/app/composables/useEngine'
import { useGameSession } from '~~/app/composables/useGameSession'
import ChoiceGrid from '~~/app/components/ChoiceGrid.vue'
import { generateFacts } from './generator'
import Play from './Play.vue'

const globals = globalThis as unknown as Record<string, unknown>
globals.useEngine = useEngine
globals.useGameSession = useGameSession

const stubs = { GameFrame: { template: '<div class="frame-stub"><slot /></div>' } }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function mountPlay(seed: number, difficulty: number) {
  return mount(Play, {
    props: { seed, difficulty, durationS: 300 },
    global: { stubs, components: { ChoiceGrid } },
    attachTo: document.body,
  })
}

type Wrapper = ReturnType<typeof mountPlay>

async function advance(wrapper: Wrapper, ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
  await wrapper.vm.$nextTick()
}

async function skipToRecall(wrapper: Wrapper) {
  await wrapper.vm.$nextTick()
  await wrapper.find('.run__next').trigger('click')
  await advance(wrapper, 21000)
}

async function answerAll(wrapper: Wrapper, picks: number[]) {
  for (const pick of picks) {
    const buttons = wrapper.findAll('button.choice')
    expect(buttons.length).toBe(4)
    await buttons[pick]!.trigger('click')
    await wrapper.vm.$nextTick()
  }
  await advance(wrapper, 600)
}

function finishPayload(wrapper: Wrapper) {
  const events = wrapper.emitted('finish')
  return events ? (events[0] as unknown[])[0] as {
    rawScore: number
    accuracy: number
    metrics: Record<string, number>
    trials: { response: unknown }[]
  } : null
}

describe('faktenlernen play surface', () => {
  it('shows every profile with all three facts and exactly one status region', async () => {
    const wrapper = mountPlay(7, 1)
    await wrapper.vm.$nextTick()
    const trial = generateFacts(1, createRng(7))

    expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
    expect(wrapper.findAll('.profile')).toHaveLength(trial.payload.profiles.length)
    expect(wrapper.findAll('.profile__fact')).toHaveLength(trial.payload.profiles.length * 3)

    const html = wrapper.html()
    for (const profile of trial.payload.profiles) {
      expect(html).toContain(profile.person)
      expect(html).toContain(profile.ort)
      expect(html).toContain(profile.beruf)
      expect(html).toContain(profile.hobby)
    }
    expect(html).toContain('Steckbriefe einprägen')
    expect(wrapper.find('.run__next').text()).toBe('Weiter')

    wrapper.unmount()
  })

  it('moves from the profiles through the distraction into the recall', async () => {
    const wrapper = mountPlay(11, 2)
    await wrapper.vm.$nextTick()
    const trial = generateFacts(2, createRng(11))

    await wrapper.find('.run__next').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.profile')).toHaveLength(0)
    expect(wrapper.html()).toContain(trial.payload.distractionPrompt)
    expect(wrapper.find('.run__number').text()).toBe(String(trial.payload.distractionNumbers[0]))

    const parity = wrapper.findAll('button.choice')
    expect(parity).toHaveLength(2)
    await parity[0]!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.run__number').text()).toBe(String(trial.payload.distractionNumbers[1]))

    await advance(wrapper, 21000)

    expect(wrapper.find('.run__question').text()).toBe(trial.payload.questions[0]!.text)
    expect(wrapper.findAll('button.choice')).toHaveLength(4)
    expect(wrapper.find('[role="status"]').text()).toBe(
      `Frage 1 von ${trial.payload.questions.length}`,
    )

    wrapper.unmount()
  })

  it('waits out the learning window without a tap', async () => {
    const wrapper = mountPlay(23, 5)
    await wrapper.vm.$nextTick()
    const trial = generateFacts(5, createRng(23))

    await advance(wrapper, trial.payload.learnS * 1000 + 400)
    expect(wrapper.html()).toContain(trial.payload.distractionPrompt)

    await advance(wrapper, trial.payload.distractionS * 1000 + 400)
    expect(wrapper.find('.run__question').text()).toBe(trial.payload.questions[0]!.text)

    wrapper.unmount()
  })

  it('scores a flawless recall as one', async () => {
    const wrapper = mountPlay(31, 3)
    const trial = generateFacts(3, createRng(31))
    await skipToRecall(wrapper)
    await answerAll(wrapper, trial.answer)

    const payload = finishPayload(wrapper)
    expect(payload).not.toBeNull()
    expect(payload!.rawScore).toBe(1)
    expect(payload!.accuracy).toBe(1)
    expect(payload!.metrics.korrekt).toBe(trial.answer.length)
    expect(payload!.metrics.gesamt).toBe(trial.answer.length)
    expect(payload!.metrics.anzahlProfile).toBe(trial.payload.profiles.length)
    expect(payload!.metrics.lernzeitMs).toBe(trial.payload.learnS * 1000)
    expect(payload!.trials).toHaveLength(1)
    expect(payload!.trials[0]!.response).toEqual(trial.answer)
    expect(wrapper.find('[role="status"]').text()).toBe(
      `${trial.answer.length} von ${trial.answer.length} richtig`,
    )

    wrapper.unmount()
  })

  it('scores a run of wrong picks as zero', async () => {
    const wrapper = mountPlay(41, 1)
    const trial = generateFacts(1, createRng(41))
    await skipToRecall(wrapper)
    await answerAll(wrapper, trial.answer.map((index) => (index + 1) % 4))

    const payload = finishPayload(wrapper)
    expect(payload!.rawScore).toBe(0)
    expect(payload!.metrics.korrekt).toBe(0)
    expect(payload!.metrics.gesamt).toBe(trial.answer.length)

    wrapper.unmount()
  })
})
