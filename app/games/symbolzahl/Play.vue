<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import type { GameFinishPayload } from '~/composables/useGameSession'
import type { SymbolzahlPayload } from './generator'
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

const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9]

const task = computed(() => (current.value?.payload ?? null) as SymbolzahlPayload | null)
const locked = computed(() => feedback.value !== null)
const expected = computed(() => (feedback.value ? Number(feedback.value.expected) : null))
const chosen = computed(() => (feedback.value ? Number(feedback.value.received) : null))

function keyState(digit: number): 'correct' | 'wrong' | 'idle' {
  if (feedback.value === null) return 'idle'
  if (digit === expected.value) return 'correct'
  if (digit === chosen.value) return 'wrong'
  return 'idle'
}

function answer(digit: number) {
  if (locked.value || !current.value) return
  engine.submit(digit)
}

function onKeydown(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const digit = Number.parseInt(event.key, 10)
  if (!Number.isFinite(digit) || digit < 1 || digit > 9) return
  answer(digit)
  event.preventDefault()
}

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
      <p class="eyebrow run__eyebrow">Zeichentabelle</p>

      <div class="legend card">
        <div
          v-for="entry in task?.legend ?? []"
          :key="entry.id"
          class="legend__cell"
          :class="{ 'is-target': feedback !== null && entry.digit === expected }"
        >
          <span class="legend__glyph" aria-hidden="true" v-html="entry.svg" />
          <span class="legend__digit num">{{ entry.digit }}</span>
        </div>
      </div>

      <div class="stage">
        <div
          class="stage__card card"
          :class="{
            'is-correct': feedback !== null && feedback.correct,
            'is-wrong': feedback !== null && !feedback.correct,
          }"
        >
          <span v-if="task" class="stage__glyph" aria-hidden="true" v-html="task.symbolSvg" />
          <span v-if="feedback !== null" class="stage__mark" aria-hidden="true">
            {{ feedback.correct ? '✓' : '✗' }}
          </span>
        </div>
      </div>

      <p class="run__hint" role="status">
        <span v-if="feedback !== null && !feedback.correct" class="num">richtig wäre {{ expected }}</span>
        <span v-else-if="feedback !== null">richtig</span>
        <span v-else>welche Ziffer gehört zu diesem Zeichen?</span>
      </p>

      <div class="keys">
        <button
          v-for="digit in keys"
          :key="digit"
          type="button"
          class="keys__key num tap"
          :class="`is-${keyState(digit)}`"
          :disabled="locked"
          @click="answer(digit)"
        >
          {{ digit }}
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
  padding-bottom: 0.375rem;
}

.legend {
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr));
  gap: 0.125rem;
  padding: 0.375rem 0.25rem;
}

.legend__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  min-width: 0;
  padding-block: 0.25rem 0.1875rem;
  border-radius: 0.5rem;
  border: 1px solid transparent;
}

.legend__cell.is-target {
  border-color: var(--pass);
  background-color: color-mix(in srgb, var(--pass) 14%, var(--raised));
}

.legend__glyph {
  display: block;
  width: 100%;
  max-width: 1.5rem;
  color: var(--ink);
}

.legend__glyph :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}

.legend__digit {
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  color: var(--muted);
}

.legend__cell.is-target .legend__digit {
  color: var(--pass);
}

.stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 11rem;
  padding-block: 1.25rem;
}

.stage__card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 8.5rem;
  height: 8.5rem;
  background-color: var(--sunken);
  transition: border-color 120ms ease;
}

.stage__card.is-correct {
  border-color: var(--pass);
}

.stage__card.is-wrong {
  border-color: var(--fail);
}

.stage__glyph {
  display: block;
  width: 5.5rem;
  color: var(--ink);
}

.stage__glyph :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
  stroke-width: 1.6;
}

.stage__mark {
  position: absolute;
  right: 0.5rem;
  bottom: 0.375rem;
  font-size: 1.25rem;
  font-weight: 700;
}

.stage__card.is-correct .stage__mark {
  color: var(--pass);
}

.stage__card.is-wrong .stage__mark {
  color: var(--fail);
}

.run__hint {
  min-height: 1.5rem;
  padding-block: 0.25rem 0.75rem;
  font-size: 0.875rem;
  text-align: center;
  color: var(--muted);
}

.keys {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}

.keys__key {
  min-height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.375rem;
  font-weight: 500;
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
  opacity: 0.45;
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

@media (min-width: 24rem) {
  .legend {
    gap: 0.25rem;
    padding: 0.5rem 0.375rem;
  }

  .legend__glyph {
    max-width: 1.75rem;
  }
}
</style>
