import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRng } from '~~/shared/rng'
import { useEngine } from '~~/app/composables/useEngine'
import { useGameSession } from '~~/app/composables/useGameSession'
import ChoiceGrid from '~~/app/components/ChoiceGrid.vue'
import NumberPad from '~~/app/components/NumberPad.vue'
import Play from './Play.vue'
import { generateDatenlesen, type DatenPayload } from './generator'

const globals = globalThis as unknown as Record<string, unknown>
globals.useEngine = useEngine
globals.useGameSession = useGameSession

const stubs = { GameFrame: { template: '<div class="frame-stub"><slot /></div>' } }
const components = { ChoiceGrid, NumberPad }

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function seedFor(gesucht: 'wahl' | 'zahl', chart?: string): number {
  for (let seed = 1; seed < 5000; seed++) {
    const trial = generateDatenlesen(1, createRng(seed))
    const payload = trial.payload as DatenPayload
    if (chart && payload.chart !== chart) continue
    if (gesucht === 'wahl' && trial.options) return seed
    if (gesucht === 'zahl' && !trial.options) return seed
  }
  throw new Error(`kein Seed fuer ${gesucht}`)
}

function seedForTwoNumbers(): number {
  for (let seed = 1; seed < 5000; seed++) {
    const rng = createRng(seed)
    const erste = generateDatenlesen(1, rng)
    const zweite = generateDatenlesen(1, rng)
    if (!erste.options && !zweite.options) return seed
  }
  throw new Error('kein Seed mit zwei Zahlenaufgaben')
}

function mountAt(seed: number) {
  return mount(Play, {
    props: { seed, difficulty: 1, durationS: 60 },
    global: { stubs, components },
    attachTo: document.body,
  })
}

describe('datenlesen play surface', () => {
  it('renders exactly one status region, before and during the feedback', async () => {
    const seed = seedFor('wahl')
    const wrapper = mountAt(seed)
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[role="status"]').length).toBe(1)

    await wrapper.findAll('.choice')[0]!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[role="status"]').length).toBe(1)

    wrapper.unmount()
  })

  it('shows the question, the chart and a choice for every option', async () => {
    const seed = seedFor('wahl')
    const trial = generateDatenlesen(1, createRng(seed))
    const payload = trial.payload as DatenPayload
    const wrapper = mountAt(seed)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain(payload.frage)
    expect(wrapper.text()).toContain(payload.titel)
    expect(wrapper.findAll('.choice').length).toBe(trial.options!.length)
    expect(wrapper.find('.pad').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('ß')

    wrapper.unmount()
  })

  it('draws a real table for the table item and an inline svg for the charts', async () => {
    const tabelle = mountAt(seedFor('wahl', 'tabelle'))
    await tabelle.vm.$nextTick()
    const zeilen = tabelle.findAll('.run__table tbody tr')
    expect(zeilen.length).toBeGreaterThanOrEqual(3)
    expect(tabelle.find('.run__figure').exists()).toBe(false)
    tabelle.unmount()

    const kreis = mountAt(seedFor('wahl', 'kreis'))
    await kreis.vm.$nextTick()
    expect(kreis.find('.run__figure svg').exists()).toBe(true)
    expect(kreis.find('.run__table').exists()).toBe(false)
    kreis.unmount()
  })

  it('marks the right choice as correct and names the solution when it is wrong', async () => {
    const seed = seedFor('wahl')
    const trial = generateDatenlesen(1, createRng(seed))
    const richtig = trial.correctIndex!

    const treffer = mountAt(seed)
    await treffer.vm.$nextTick()
    await treffer.findAll('.choice')[richtig]!.trigger('click')
    await treffer.vm.$nextTick()
    expect(treffer.find('[role="status"]').text()).toContain('richtig')
    expect(treffer.find('[role="status"]').text()).not.toContain('wäre')
    treffer.unmount()

    const daneben = mountAt(seed)
    await daneben.vm.$nextTick()
    const falsch = richtig === 0 ? 1 : 0
    await daneben.findAll('.choice')[falsch]!.trigger('click')
    await daneben.vm.$nextTick()
    const text = daneben.find('[role="status"]').text()
    expect(text).toContain('wäre')
    expect(text).toContain(trial.options![richtig]!.label)
    daneben.unmount()
  })

  it('answers a numeric item through the number pad and shows the unit', async () => {
    const seed = seedFor('zahl')
    const trial = generateDatenlesen(1, createRng(seed))
    const payload = trial.payload as DatenPayload
    const wrapper = mountAt(seed)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.pad').exists()).toBe(true)
    expect(wrapper.findAll('.choice').length).toBe(0)
    expect(wrapper.find('.run__suffix').text()).toBe(payload.suffix)

    for (const ziffer of String(trial.answer)) {
      const taste = wrapper.findAll('.pad__key').find((key) => key.text() === ziffer)
      await taste!.trigger('click')
    }
    expect(wrapper.find('.run__value').text()).toBe(String(trial.answer))

    await wrapper.find('.pad__key--accent').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="status"]').text()).toContain('richtig')
    expect(wrapper.find('.run__answer').classes()).toContain('is-correct')

    wrapper.unmount()
  })

  it('clears the entry when the next item arrives', async () => {
    const seed = seedForTwoNumbers()
    const rng = createRng(seed)
    const erste = generateDatenlesen(1, rng)
    const zweite = generateDatenlesen(1, rng)
    const wrapper = mountAt(seed)
    await wrapper.vm.$nextTick()

    const taste = wrapper.findAll('.pad__key').find((key) => key.text() === '7')
    await taste!.trigger('click')
    expect(wrapper.find('.run__value').text()).toBe('7')
    expect(wrapper.text()).toContain((erste.payload as DatenPayload).frage)

    await wrapper.find('.pad__key--accent').trigger('click')
    await wait(600)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.run__value').text()).toBe('·')
    expect(wrapper.text()).toContain((zweite.payload as DatenPayload).frage)
    expect(wrapper.find('[role="status"]').text()).toBe('')

    wrapper.unmount()
  })

  it('reports a session with the metrics the result screen expects', async () => {
    const wrapper = mount(Play, {
      props: { seed: seedFor('wahl'), difficulty: 1, durationS: 2 },
      global: { stubs, components },
      attachTo: document.body,
    })
    await wrapper.vm.$nextTick()

    const ticker = setInterval(() => {
      const choice = document.querySelector('.choice') as HTMLButtonElement | null
      if (choice && !choice.disabled) choice.click()
    }, 40)
    await wait(2600)
    clearInterval(ticker)
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('finish')
    expect(events).toBeTruthy()
    const payload = (events![0] as any[])[0]
    expect(payload.trials.length).toBeGreaterThan(0)
    for (const key of [
      'attempted',
      'correct',
      'rechenTreffer',
      'lesenTreffer',
      'tabelleTreffer',
      'diagrammTreffer',
      'medianRtMs',
      'meanDifficulty',
    ]) {
      expect(payload.metrics, key).toHaveProperty(key)
    }
    expect(payload.metrics.attempted).toBe(payload.trials.length)
    expect(payload.metrics.rechenTreffer + payload.metrics.lesenTreffer).toBe(payload.metrics.correct)
    expect(payload.metrics.tabelleTreffer + payload.metrics.diagrammTreffer).toBe(payload.metrics.correct)

    wrapper.unmount()
  })
})
