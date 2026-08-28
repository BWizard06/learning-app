import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRng } from '~~/shared/rng'
import { useEngine } from '~~/app/composables/useEngine'
import { useGameSession } from '~~/app/composables/useGameSession'
import ChoiceGrid from '~~/app/components/ChoiceGrid.vue'
import { generateSeries, type SeriesPayload } from './generator'
import Play from './Play.vue'

const globals = globalThis as unknown as Record<string, unknown>
globals.useEngine = useEngine
globals.useGameSession = useGameSession

const stubs = { GameFrame: { template: '<div class="frame-stub"><slot /></div>' } }

function mountPlay(seed: number, difficulty: number) {
  return mount(Play, {
    props: { seed, difficulty, durationS: 30 },
    global: { stubs, components: { ChoiceGrid } },
    attachTo: document.body,
  })
}

describe('figurenreihen play surface', () => {
  it('shows the row, the open slot and exactly one status region', async () => {
    const wrapper = mountPlay(7, 1)
    await wrapper.vm.$nextTick()
    const payload = generateSeries(1, createRng(7)).payload as SeriesPayload

    expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
    expect(wrapper.findAll('.run__slot')).toHaveLength(payload.figures.length + 1)
    expect(wrapper.findAll('.run__slot--open')).toHaveLength(1)
    expect(wrapper.findAll('button.choice')).toHaveLength(6)
    expect(wrapper.findAll('.run__figure svg')).toHaveLength(payload.figures.length)
    expect(wrapper.html()).toContain('Welche Figur setzt die Reihe fort?')

    wrapper.unmount()
  })

  it('marks the pick that continues the row', async () => {
    const wrapper = mountPlay(7, 1)
    await wrapper.vm.$nextTick()
    const trial = generateSeries(1, createRng(7))

    await wrapper.findAll('button.choice')[trial.correctIndex!]!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="status"]').text()).toContain('richtig')
    expect(wrapper.findAll('.choice.is-correct')).toHaveLength(1)
    expect(wrapper.findAll('.choice.is-wrong')).toHaveLength(0)

    wrapper.unmount()
  })

  it('reveals the right figure after a wrong pick', async () => {
    const wrapper = mountPlay(7, 1)
    await wrapper.vm.$nextTick()
    const trial = generateSeries(1, createRng(7))
    const missed = (trial.correctIndex! + 1) % 6

    await wrapper.findAll('button.choice')[missed]!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="status"]').text()).toContain('setzt die Reihe fort')
    expect(wrapper.findAll('.choice.is-correct')).toHaveLength(1)
    expect(wrapper.findAll('.choice.is-wrong')).toHaveLength(1)
    expect(wrapper.findAll('button.choice')[trial.correctIndex!]!.classes()).toContain('is-correct')

    wrapper.unmount()
  })
})
