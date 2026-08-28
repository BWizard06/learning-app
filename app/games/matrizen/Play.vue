<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ChoiceOption } from '~~/shared/types'
import type { GameFinishPayload } from '~/composables/useGameSession'
import type { MatrixPayload } from './generator'
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

const chosen = ref<number | null>(null)

const task = computed(() => (current.value?.payload ?? null) as MatrixPayload | null)
const options = computed<ChoiceOption[]>(() => current.value?.options ?? [])
const locked = computed(() => feedback.value !== null)
const revealIndex = computed(() => (feedback.value ? Number(feedback.value.expected) : null))
const hit = computed(() => feedback.value?.correct === true)

watch(current, () => {
  chosen.value = null
})

function spotOf(index: number) {
  return `Zeile ${Math.floor(index / 3) + 1}, Spalte ${(index % 3) + 1}`
}

function choose(index: number) {
  if (locked.value) return
  chosen.value = index
  engine.submit(index)
}

onMounted(() => engine.start())
onBeforeUnmount(() => engine.dispose())
</script>

<template>
  <GameFrame :engine="engine">
    <div class="run">
      <p class="eyebrow run__eyebrow">{{ task?.question ?? '' }}</p>

      <div v-if="task" class="run__matrix card" role="group" aria-label="Matrix mit drei mal drei Feldern">
        <div v-for="(cell, index) in task.cells" :key="index" class="run__cell">
          <span class="sr-only">{{ spotOf(index) }}</span>
          <span class="run__figure" v-html="cell" />
        </div>
        <div class="run__cell run__cell--open">
          <span class="num run__ask" aria-hidden="true">?</span>
          <span class="sr-only">{{ spotOf(8) }}, gesuchtes Feld</span>
        </div>
      </div>

      <p class="run__hint" role="status">
        <span v-if="feedback && hit">✓ richtig</span>
        <span v-else-if="feedback">✗ die markierte Figur passt</span>
        <span v-else>&nbsp;</span>
      </p>

      <div class="run__choices">
        <ChoiceGrid
          :options="options"
          :columns="3"
          :disabled="locked"
          :reveal-index="revealIndex"
          :chosen-index="chosen"
          @select="choose"
        />
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

.run__matrix {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  padding: 1px;
  overflow: hidden;
  background-color: var(--rule);
}

.run__cell {
  display: flex;
  aspect-ratio: 1;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  color: var(--ink);
  background-color: var(--raised);
}

.run__figure {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
}

.run__cell :deep(svg) {
  width: 100%;
  height: 100%;
}

.run__cell--open {
  background-color: var(--sunken);
}

.run__ask {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--accent);
}

.run__hint {
  min-height: 1.75rem;
  padding-block: 0.625rem 0.375rem;
  font-size: 0.875rem;
  text-align: center;
  color: var(--muted);
}

.run__choices {
  margin-top: auto;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}
</style>
