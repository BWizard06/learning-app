<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GameFinishPayload } from '~/composables/useGameSession'
import type { ComparePayload } from './generator'
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

const chosen = ref<boolean | null>(null)

const task = computed(() => (current.value?.payload ?? null) as ComparePayload | null)
const locked = computed(() => feedback.value !== null)
const hit = computed(() => feedback.value?.correct === true)
const wasSame = computed(() => feedback.value?.expected === true)
const long = computed(() => (task.value?.length ?? 0) > 12)

function spelled(value: string): string {
  return value.split('').join(' ')
}

function stateOf(value: boolean): 'correct' | 'wrong' | 'idle' {
  if (feedback.value === null) return 'idle'
  if (value === wasSame.value) return 'correct'
  if (value === chosen.value) return 'wrong'
  return 'idle'
}

function answer(same: boolean) {
  if (locked.value || !current.value) return
  chosen.value = same
  engine.submit(same)
}

function onKeydown(event: KeyboardEvent) {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
  if (locked.value) return
  const key = event.key.toLowerCase()
  if (key === 'g' || key === '1' || key === 'arrowleft') {
    answer(true)
    event.preventDefault()
    return
  }
  if (key === 'v' || key === '2' || key === 'arrowright') {
    answer(false)
    event.preventDefault()
  }
}

watch(current, () => {
  chosen.value = null
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  engine.start()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  engine.dispose()
})
</script>

<template>
  <GameFrame :engine="engine">
    <div class="run">
      <p class="eyebrow run__eyebrow">Sind die beiden Reihen genau gleich?</p>

      <div class="run__pair card" :class="{ 'is-long': long }">
        <p class="run__row num">
          <span class="sr-only">Obere Reihe: {{ spelled(task?.top ?? '') }}</span>
          <span aria-hidden="true">{{ task?.top ?? '' }}</span>
        </p>
        <p class="run__row num">
          <span class="sr-only">Untere Reihe: {{ spelled(task?.bottom ?? '') }}</span>
          <span aria-hidden="true">{{ task?.bottom ?? '' }}</span>
        </p>
      </div>

      <p class="run__hint" role="status">
        <span v-if="feedback && hit">✓ richtig</span>
        <span v-else-if="feedback && wasSame">✗ falsch, die Reihen waren gleich</span>
        <span v-else-if="feedback">✗ falsch, die Reihen waren verschieden</span>
        <span v-else>&nbsp;</span>
      </p>

      <div class="run__keys">
        <button
          type="button"
          class="key tap"
          :class="`is-${stateOf(true)}`"
          :disabled="locked"
          @click="answer(true)"
        >
          <span class="key__hint num" aria-hidden="true">G</span>
          <span class="key__label">gleich</span>
          <span v-if="stateOf(true) === 'correct'" class="key__mark" aria-label="richtig">✓</span>
          <span v-else-if="stateOf(true) === 'wrong'" class="key__mark" aria-label="falsch">✗</span>
        </button>

        <button
          type="button"
          class="key tap"
          :class="`is-${stateOf(false)}`"
          :disabled="locked"
          @click="answer(false)"
        >
          <span class="key__hint num" aria-hidden="true">V</span>
          <span class="key__label">verschieden</span>
          <span v-if="stateOf(false) === 'correct'" class="key__mark" aria-label="richtig">✓</span>
          <span v-else-if="stateOf(false) === 'wrong'" class="key__mark" aria-label="falsch">✗</span>
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
}

.run__eyebrow {
  padding-block: 0.25rem 0.75rem;
}

.run__pair {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.75rem;
  overflow: hidden;
}

.run__row {
  display: flex;
  justify-content: center;
  padding-block: 0.875rem;
  font-size: clamp(1.05rem, 5.4vw, 1.6rem);
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: 0.16em;
  text-indent: 0.16em;
  white-space: nowrap;
}

.run__pair.is-long .run__row {
  font-size: clamp(0.9rem, 4.4vw, 1.3rem);
}

.run__row + .run__row {
  border-top: 1px solid var(--rule);
}

.run__hint {
  min-height: 1.75rem;
  padding-block: 0.75rem 0.375rem;
  font-size: 0.875rem;
  text-align: center;
  color: var(--muted);
}

.run__keys {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  margin-top: auto;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}

.key {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 5rem;
  padding: 0.75rem 1rem;
  color: var(--ink);
  background-color: var(--raised);
  border: 1px solid var(--rule);
  border-radius: var(--radius-key);
  box-shadow: var(--shadow-key);
  transition: background-color 90ms ease, border-color 90ms ease, transform 90ms ease;
}

.key:active:not(:disabled) {
  transform: translateY(1px);
}

.key:disabled {
  cursor: default;
}

.key__label {
  font-size: 1.125rem;
  font-weight: 600;
}

.key__hint {
  position: absolute;
  top: 0.375rem;
  left: 0.5rem;
  font-size: 0.6875rem;
  color: var(--faint);
}

.key__mark {
  position: absolute;
  top: 0.375rem;
  right: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 700;
}

.key.is-correct {
  border-color: var(--pass);
  background-color: color-mix(in srgb, var(--pass) 12%, var(--raised));
}

.key.is-correct .key__mark {
  color: var(--pass);
}

.key.is-wrong {
  border-color: var(--fail);
  background-color: color-mix(in srgb, var(--fail) 12%, var(--raised));
}

.key.is-wrong .key__mark {
  color: var(--fail);
}
</style>
