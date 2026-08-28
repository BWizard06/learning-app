<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GameFinishPayload } from '~/composables/useGameSession'
import type { Channel, NbackPayload, NbackResponse } from './generator'
import {
  CELLS,
  CENTER_CELL,
  FEEDBACK_MS,
  channelsFromParams,
  levelTextFor,
  matchesFromParams,
  readResponse,
  ruleTextFor,
} from './generator'
import definition from './definition'

const props = defineProps<{ seed: number; difficulty: number; durationS?: number }>()
const emit = defineEmits<{ finish: [GameFinishPayload] }>()

const engine = useEngine({
  definition,
  seed: props.seed,
  startDifficulty: props.difficulty,
  durationS: props.durationS,
  feedbackMs: FEEDBACK_MS,
})
const { current, feedback } = engine

useGameSession(engine, (payload) => emit('finish', payload))

const EMPTY: NbackResponse = { position: false, letter: false, positionRtMs: 0, letterRtMs: 0 }

const tapped = ref<NbackResponse>({ ...EMPTY })
const shown = ref(0)

const stimulus = computed(() => (current.value?.payload ?? null) as NbackPayload | null)
const locked = computed(() => feedback.value !== null || current.value === null)
const visible = computed(() => stimulus.value !== null && feedback.value === null)
const durationMs = computed(() => stimulus.value?.durationMs ?? 0)

const channels = computed<readonly Channel[]>(() =>
  current.value ? channelsFromParams(current.value.params) : [],
)

const showsGrid = computed(() => stimulus.value?.variant !== 'verbal')
const showsLetter = computed(() => stimulus.value?.variant !== 'visuell')

const ruleText = computed(() =>
  stimulus.value ? ruleTextFor(stimulus.value.variant, stimulus.value.n) : '',
)

const levelText = computed(() =>
  stimulus.value ? levelTextFor(stimulus.value.variant, stimulus.value.n) : '',
)

const stageLabel = computed(() => {
  const item = stimulus.value
  if (!item || !visible.value) return 'Pause'
  const parts: string[] = []
  if (item.position !== null) {
    parts.push(`Feld ${(item.position % 3) + 1} in Reihe ${Math.floor(item.position / 3) + 1}`)
  }
  if (item.letter !== null) parts.push(`Buchstabe ${item.letter}`)
  return parts.join(', ')
})

const verdict = computed(() => {
  const trial = current.value
  const result = feedback.value
  if (!trial || !result) return null
  const expected = matchesFromParams(trial.params)
  const given = readResponse(result.received)
  const parts = channelsFromParams(trial.params).map((channel) => {
    const label = channel === 'position' ? 'Position' : 'Buchstabe'
    if (expected[channel] && given[channel]) return `${label} getroffen`
    if (expected[channel]) return `${label} verpasst`
    if (given[channel]) return `${label} war kein Treffer`
    return `${label} richtig gewartet`
  })
  return { correct: result.correct, mark: result.correct ? '✓' : '✗', text: parts.join(', ') }
})

const tally = computed(() => {
  let treffer = 0
  let fehler = 0
  for (const entry of engine.results) {
    const expected = matchesFromParams(entry.params)
    const given = readResponse(entry.response)
    for (const channel of channelsFromParams(entry.params)) {
      if (expected[channel] && given[channel]) treffer++
      else if (expected[channel] || given[channel]) fehler++
    }
  }
  return { treffer, fehler }
})

let rafHandle = 0
let shownAt = 0

function clock(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function buttonLabel(channel: Channel): string {
  if (channels.value.length === 1) return 'Treffer'
  return channel === 'position' ? 'Position' : 'Buchstabe'
}

function tap(channel: Channel) {
  if (locked.value || !channels.value.includes(channel)) return
  const elapsed = Math.max(1, Math.round(clock() - shownAt))
  if (channel === 'position') {
    if (tapped.value.position) return
    tapped.value = { ...tapped.value, position: true, positionRtMs: elapsed }
    return
  }
  if (tapped.value.letter) return
  tapped.value = { ...tapped.value, letter: true, letterRtMs: elapsed }
}

function frame() {
  rafHandle = requestAnimationFrame(frame)
  if (current.value === null || feedback.value !== null) return
  if (clock() - shownAt < durationMs.value) return
  const state = tapped.value
  engine.submit(state.position || state.letter ? { ...state } : null)
}

function onKeydown(event: KeyboardEvent) {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
  const key = event.key.toLowerCase()
  const dual = channels.value.length > 1
  if (!dual) {
    if (key !== ' ' && key !== 'enter') return
    event.preventDefault()
    tap(channels.value[0]!)
    return
  }
  if (key === 'a' || key === 'arrowleft') {
    event.preventDefault()
    tap('position')
    return
  }
  if (key === 'l' || key === 'arrowright') {
    event.preventDefault()
    tap('letter')
  }
}

watch(
  current,
  (trial) => {
    if (trial === null) return
    shownAt = clock()
    shown.value++
    tapped.value = { ...EMPTY }
  },
  { flush: 'sync' },
)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  engine.start()
  rafHandle = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (rafHandle) cancelAnimationFrame(rafHandle)
  engine.dispose()
})
</script>

<template>
  <GameFrame :engine="engine">
    <div class="run">
      <div class="run__rule card">
        <p class="eyebrow">{{ levelText }}</p>
        <p class="run__rule-text">{{ ruleText }}</p>
      </div>

      <div class="stage">
        <div
          class="stage__plate card"
          :class="{
            'is-correct': verdict !== null && verdict.correct,
            'is-wrong': verdict !== null && !verdict.correct,
          }"
          role="img"
          :aria-label="stageLabel"
        >
          <div v-if="showsGrid" class="grid">
            <span
              v-for="cell in CELLS"
              :key="cell"
              class="grid__cell"
              :class="{
                'is-center': cell === CENTER_CELL,
                'is-active': visible && stimulus !== null && cell === stimulus.position,
              }"
            >
              <span
                v-if="showsLetter && visible && stimulus !== null && cell === stimulus.position"
                class="grid__letter num"
              >{{ stimulus.letter }}</span>
            </span>
          </div>
          <span v-else class="stage__letter num">{{ visible ? stimulus?.letter : '·' }}</span>

          <span v-if="verdict" class="stage__mark" aria-hidden="true">{{ verdict.mark }}</span>
        </div>

        <div class="stage__window" aria-hidden="true">
          <span
            v-if="visible"
            :key="shown"
            class="stage__window-fill"
            :style="{ animationDuration: `${durationMs}ms` }"
          />
        </div>
      </div>

      <p class="run__status" role="status">
        <span v-if="verdict">{{ verdict.mark }} {{ verdict.text }}</span>
        <span v-else>&nbsp;</span>
      </p>

      <div class="foot">
        <p class="foot__tally num">
          <span>{{ tally.treffer }} Treffer</span>
          <span aria-hidden="true">·</span>
          <span>{{ tally.fehler }} Fehler</span>
        </p>

        <div class="foot__keys">
          <button
            v-for="channel in channels"
            :key="channel"
            type="button"
            class="foot__key tap"
            :class="{ 'is-armed': tapped[channel] }"
            :disabled="locked"
            :aria-pressed="tapped[channel]"
            @click="tap(channel)"
          >
            <span v-if="tapped[channel]" aria-hidden="true">✓</span>
            {{ buttonLabel(channel) }}
          </button>
        </div>
      </div>
    </div>
  </GameFrame>
</template>

<style scoped>
.run {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.run__rule {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.625rem 0.875rem;
  text-align: center;
}

.run__rule-text {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--muted);
}

.stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 13rem;
  padding-block: 1.25rem;
}

.stage__plate {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 15rem;
  height: 15rem;
  max-width: 78vw;
  max-height: 78vw;
  padding: 0.75rem;
  background-color: var(--sunken);
  transition: border-color 90ms ease;
}

.stage__plate.is-correct {
  border-color: var(--pass);
}

.stage__plate.is-wrong {
  border-color: var(--fail);
}

.grid {
  display: grid;
  width: 100%;
  height: 100%;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 0.375rem;
}

.grid__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--rule);
  border-radius: 0.375rem;
  background-color: var(--raised);
}

.grid__cell.is-center {
  background-color: var(--paper);
}

.grid__cell.is-active {
  border: 3px solid var(--accent);
  background-color: var(--accent);
  color: var(--accent-ink);
}

.grid__letter {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1;
}

.stage__letter {
  font-size: 5rem;
  font-weight: 600;
  line-height: 1;
  color: var(--ink);
}

.stage__mark {
  position: absolute;
  right: 0.625rem;
  bottom: 0.5rem;
  font-size: 1.375rem;
  font-weight: 700;
}

.stage__plate.is-correct .stage__mark {
  color: var(--pass);
}

.stage__plate.is-wrong .stage__mark {
  color: var(--fail);
}

.stage__window {
  width: 15rem;
  max-width: 78vw;
  height: 4px;
  overflow: hidden;
  background-color: var(--sunken);
  border-radius: 2px;
}

.stage__window-fill {
  display: block;
  width: 100%;
  height: 100%;
  transform-origin: left center;
  background-color: var(--accent);
  animation-name: nback-shrink;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes nback-shrink {
  from {
    transform: scaleX(1);
  }

  to {
    transform: scaleX(0);
  }
}

.run__status {
  min-height: 1.5rem;
  padding-block: 0.25rem 0.75rem;
  font-size: 0.875rem;
  text-align: center;
  color: var(--muted);
}

.foot {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}

.foot__tally {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--faint);
}

.foot__keys {
  display: flex;
  gap: 0.5rem;
}

.foot__key {
  flex: 1;
  min-height: 5rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--accent-ink);
  background-color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: var(--radius-key);
  box-shadow: var(--shadow-key);
  transition: transform 90ms ease, opacity 90ms ease;
}

.foot__key:disabled {
  opacity: 0.45;
  cursor: default;
}

.foot__key:active:not(:disabled) {
  transform: translateY(1px);
}

.foot__key.is-armed {
  color: var(--accent);
  background-color: var(--accent-soft);
}

@media (prefers-reduced-motion: reduce) {
  .stage__window {
    visibility: hidden;
  }
}
</style>
