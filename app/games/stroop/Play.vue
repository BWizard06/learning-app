<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GameFinishPayload } from '~/composables/useGameSession'
import { COLORS, type StroopColor, type StroopPayload } from './generator'
import definition from './definition'

const props = defineProps<{ seed: number; difficulty: number; durationS?: number }>()
const emit = defineEmits<{ finish: [GameFinishPayload] }>()

const engine = useEngine({
  definition,
  seed: props.seed,
  startDifficulty: props.difficulty,
  durationS: props.durationS,
})
const { current, feedback } = engine

useGameSession(engine, (payload) => emit('finish', payload))

const chosen = ref<StroopColor | null>(null)
const tooSlow = ref(false)
const elapsedMs = ref(0)
const paintedAt = ref(0)

let frame = 0
let round = 0

const task = computed(() => (current.value?.payload ?? null) as StroopPayload | null)
const locked = computed(() => feedback.value !== null)
const expected = computed(() => (feedback.value ? String(feedback.value.expected) : ''))

const remaining = computed(() => {
  const budget = task.value?.budgetMs ?? 0
  if (budget <= 0) return 1
  return Math.min(1, Math.max(0, 1 - elapsedMs.value / budget))
})

function inPalette(color: StroopColor): boolean {
  return task.value === null || task.value.palette.includes(color)
}

function keyState(color: StroopColor): 'correct' | 'wrong' | 'idle' {
  if (feedback.value === null) return 'idle'
  if (color === expected.value) return 'correct'
  if (color === chosen.value) return 'wrong'
  return 'idle'
}

function halt() {
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  round++
}

function tick() {
  if (current.value === null || feedback.value !== null) {
    frame = 0
    return
  }
  const budget = task.value?.budgetMs ?? 0
  const passed = performance.now() - paintedAt.value
  elapsedMs.value = passed
  if (budget > 0 && passed >= budget) {
    frame = 0
    timeUp()
    return
  }
  frame = requestAnimationFrame(tick)
}

function present() {
  halt()
  const mine = round
  elapsedMs.value = 0
  nextTick(() => {
    if (mine !== round) return
    frame = requestAnimationFrame(() => {
      if (mine !== round) return
      paintedAt.value = performance.now()
      elapsedMs.value = 0
      frame = requestAnimationFrame(tick)
    })
  })
}

function timeUp() {
  if (locked.value || current.value === null) return
  halt()
  chosen.value = null
  tooSlow.value = true
  engine.submit(null)
}

function answer(color: StroopColor) {
  if (locked.value || current.value === null || !inPalette(color)) return
  halt()
  chosen.value = color
  tooSlow.value = false
  engine.submit(color)
}

function onKeydown(event: KeyboardEvent) {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
  const position = Number.parseInt(event.key, 10)
  if (!Number.isFinite(position) || position < 1 || position > COLORS.length) return
  answer(COLORS[position - 1]!)
  event.preventDefault()
}

watch(current, (trial) => {
  chosen.value = null
  tooSlow.value = false
  if (trial === null) {
    halt()
    return
  }
  present()
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  engine.start()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  halt()
  engine.dispose()
})
</script>

<template>
  <GameFrame :engine="engine">
    <div class="run">
      <p class="eyebrow run__eyebrow">Welche Farbe hat die Schrift?</p>

      <div class="stage">
        <div
          class="stage__card card"
          :class="{
            'is-correct': feedback !== null && feedback.correct,
            'is-wrong': feedback !== null && !feedback.correct,
          }"
        >
          <span v-if="task" class="stage__word" :class="`stage__word--${task.color}`">{{ task.word }}</span>
          <span v-if="feedback !== null" class="stage__mark" aria-hidden="true">
            {{ feedback.correct ? '✓' : '✗' }}
          </span>
        </div>

        <div class="stage__meter" aria-hidden="true">
          <div class="stage__meter-fill" :style="{ transform: `scaleX(${remaining})` }" />
        </div>
      </div>

      <p class="run__status" role="status">
        <span v-if="feedback === null">&nbsp;</span>
        <span v-else-if="feedback.correct">✓ richtig</span>
        <span v-else-if="tooSlow">✗ zu langsam, richtig war {{ expected }}</span>
        <span v-else>✗ richtig war {{ expected }}</span>
      </p>

      <div class="keys">
        <button
          v-for="(color, index) in COLORS"
          :key="color"
          type="button"
          class="keys__key tap"
          :class="[`is-${keyState(color)}`, { 'is-out': !inPalette(color) }]"
          :disabled="locked || !inPalette(color)"
          @click="answer(color)"
        >
          <span class="keys__hint num" aria-hidden="true">{{ index + 1 }}</span>
          <span class="keys__label">{{ color }}</span>
          <span v-if="keyState(color) === 'correct'" class="keys__mark" aria-label="richtig">✓</span>
          <span v-else-if="keyState(color) === 'wrong'" class="keys__mark" aria-label="falsch">✗</span>
        </button>
      </div>
    </div>
  </GameFrame>
</template>

<style scoped>
.run {
  display: flex;
  flex: 1;
  flex-direction: column;
  --farbe-rot: #c0261c;
  --farbe-gelb: #a97400;
  --farbe-gruen: #10763c;
  --farbe-blau: #1f4fd8;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .run {
    --farbe-rot: #ff7a6b;
    --farbe-gelb: #f2c14e;
    --farbe-gruen: #4fd18a;
    --farbe-blau: #7aa2ff;
  }
}

:root[data-theme='dark'] .run {
  --farbe-rot: #ff7a6b;
  --farbe-gelb: #f2c14e;
  --farbe-gruen: #4fd18a;
  --farbe-blau: #7aa2ff;
}

.run__eyebrow {
  padding-bottom: 0.5rem;
}

.stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.5rem;
  min-height: 12rem;
  padding-block: 1rem;
}

.stage__card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 10rem;
  padding: 1rem;
  background-color: var(--sunken);
  transition: border-color 120ms ease;
}

.stage__card.is-correct {
  border-color: var(--pass);
}

.stage__card.is-wrong {
  border-color: var(--fail);
}

.stage__word {
  font-size: clamp(2.5rem, 14vw, 4rem);
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.1;
  text-transform: uppercase;
}

.stage__word--rot {
  color: var(--farbe-rot);
}

.stage__word--gelb {
  color: var(--farbe-gelb);
}

.stage__word--gruen {
  color: var(--farbe-gruen);
}

.stage__word--blau {
  color: var(--farbe-blau);
}

.stage__mark {
  position: absolute;
  right: 0.625rem;
  bottom: 0.5rem;
  font-size: 1.25rem;
  font-weight: 700;
}

.stage__card.is-correct .stage__mark {
  color: var(--pass);
}

.stage__card.is-wrong .stage__mark {
  color: var(--fail);
}

.stage__meter {
  height: 4px;
  overflow: hidden;
  border-radius: 2px;
  background-color: var(--sunken);
}

.stage__meter-fill {
  height: 100%;
  transform-origin: left center;
  background-color: var(--accent);
}

.run__status {
  min-height: 1.5rem;
  padding-block: 0.5rem 0.75rem;
  font-size: 0.875rem;
  text-align: center;
  color: var(--muted);
}

.keys {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}

.keys__key {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 4rem;
  color: var(--ink);
  background-color: var(--raised);
  border: 1px solid var(--rule);
  border-radius: var(--radius-key);
  box-shadow: var(--shadow-key);
  transition: background-color 90ms ease, border-color 90ms ease, transform 90ms ease;
}

.keys__key:active:not(:disabled) {
  transform: translateY(1px);
  background-color: var(--sunken);
}

.keys__key:disabled {
  cursor: default;
}

.keys__key:disabled.is-idle {
  opacity: 0.5;
}

.keys__key.is-out {
  opacity: 0.32;
}

.keys__label {
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.keys__hint {
  position: absolute;
  top: 0.375rem;
  left: 0.5rem;
  font-size: 0.6875rem;
  color: var(--faint);
}

.keys__mark {
  position: absolute;
  top: 0.375rem;
  right: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1;
}

.keys__key.is-correct {
  color: var(--pass);
  border-color: var(--pass);
  background-color: color-mix(in srgb, var(--pass) 12%, var(--raised));
}

.keys__key.is-wrong {
  color: var(--fail);
  border-color: var(--fail);
  background-color: color-mix(in srgb, var(--fail) 12%, var(--raised));
}
</style>
