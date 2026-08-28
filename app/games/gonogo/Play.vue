<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GameFinishPayload } from '~/composables/useGameSession'
import type { GoNoGoPayload } from './generator'
import { RULE_TEXT } from './generator'
import definition from './definition'

const props = defineProps<{ seed: number; difficulty: number; durationS?: number }>()
const emit = defineEmits<{ finish: [GameFinishPayload] }>()

const engine = useEngine({
  definition,
  seed: props.seed,
  startDifficulty: props.difficulty,
  durationS: props.durationS,
  feedbackMs: 400,
})
const { current, feedback } = engine

useGameSession(engine, (payload) => emit('finish', payload))

const shown = ref(0)

const stimulus = computed(() => (current.value?.payload ?? null) as GoNoGoPayload | null)
const locked = computed(() => feedback.value !== null)
const visible = computed(() => stimulus.value !== null && feedback.value === null)
const windowMs = computed(() => stimulus.value?.windowMs ?? 0)

const verdict = computed(() => {
  const trial = current.value
  const result = feedback.value
  if (!trial || !result) return null
  const go = trial.itemType === 'go'
  const hit = result.received === true
  if (go && hit) return { mark: '✓', text: 'richtig getippt', correct: true }
  if (go) return { mark: '✗', text: 'verpasst', correct: false }
  if (hit) return { mark: '✗', text: 'das war ein X', correct: false }
  return { mark: '✓', text: 'richtig gewartet', correct: true }
})

const tally = computed(() => {
  let treffer = 0
  for (const entry of engine.results) {
    if (entry.correct) treffer++
  }
  return { treffer, fehler: engine.results.length - treffer }
})

let rafHandle = 0
let shownAt = 0

function clock(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function tap() {
  if (feedback.value !== null || current.value === null) return
  engine.submit(true)
}

function frame() {
  rafHandle = requestAnimationFrame(frame)
  if (current.value === null || feedback.value !== null) return
  if (clock() - shownAt >= windowMs.value) engine.submit(null)
}

function onKeydown(event: KeyboardEvent) {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
  if (event.key !== ' ' && event.key !== 'Enter') return
  event.preventDefault()
  tap()
}

watch(
  current,
  (trial) => {
    if (trial === null) return
    shownAt = clock()
    shown.value++
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
      <p class="run__rule card">{{ RULE_TEXT }}</p>

      <div class="stage">
        <div
          class="stage__plate card"
          :class="{
            'is-correct': verdict !== null && verdict.correct,
            'is-wrong': verdict !== null && !verdict.correct,
          }"
        >
          <span v-if="visible && stimulus" class="stage__glyph" v-html="stimulus.svg" />
          <span v-else class="stage__pause" aria-hidden="true">·</span>
          <span v-if="verdict" class="stage__mark" aria-hidden="true">{{ verdict.mark }}</span>
        </div>

        <div class="stage__window" aria-hidden="true">
          <span
            v-if="visible"
            :key="shown"
            class="stage__window-fill"
            :style="{ animationDuration: `${windowMs}ms` }"
          />
        </div>
      </div>

      <p class="run__status" role="status">
        <span v-if="verdict">{{ verdict.mark }} {{ verdict.text }}</span>
        <span v-else>&nbsp;</span>
      </p>

      <div class="foot">
        <p class="foot__tally num">
          <span>{{ tally.treffer }} richtig</span>
          <span aria-hidden="true">·</span>
          <span>{{ tally.fehler }} Fehler</span>
        </p>

        <button type="button" class="foot__go tap" :disabled="locked" @click="tap">Tippen</button>
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
  padding: 0.625rem 0.875rem;
  font-size: 0.9375rem;
  font-weight: 500;
  text-align: center;
  color: var(--muted);
}

.stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 12rem;
  padding-block: 1.25rem;
}

.stage__plate {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 11rem;
  height: 11rem;
  background-color: var(--sunken);
  transition: border-color 90ms ease;
}

.stage__plate.is-correct {
  border-color: var(--pass);
}

.stage__plate.is-wrong {
  border-color: var(--fail);
}

.stage__glyph {
  display: block;
  width: 8rem;
  color: var(--ink);
}

.stage__glyph :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}

.stage__pause {
  font-size: 2.5rem;
  line-height: 1;
  color: var(--faint);
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
  width: 11rem;
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
  animation-name: gonogo-shrink;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes gonogo-shrink {
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

.foot__go {
  min-height: 5.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--accent-ink);
  background-color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: var(--radius-key);
  box-shadow: var(--shadow-key);
  transition: transform 90ms ease, opacity 90ms ease;
}

.foot__go:disabled {
  opacity: 0.45;
  cursor: default;
}

.foot__go:active:not(:disabled) {
  transform: translateY(1px);
}

@media (prefers-reduced-motion: reduce) {
  .stage__window {
    visibility: hidden;
  }
}
</style>
