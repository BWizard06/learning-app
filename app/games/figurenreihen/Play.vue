<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ChoiceOption } from '~~/shared/types'
import type { GameFinishPayload } from '~/composables/useGameSession'
import type { SeriesPayload } from './generator'
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

const task = computed(() => (current.value?.payload ?? null) as SeriesPayload | null)
const options = computed<ChoiceOption[]>(() => current.value?.options ?? [])
const locked = computed(() => feedback.value !== null)
const revealIndex = computed(() => (feedback.value ? Number(feedback.value.expected) : null))
const hit = computed(() => feedback.value?.correct === true)

watch(current, () => {
  chosen.value = null
})

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

      <div v-if="task" class="run__row card" role="group" aria-label="Reihe von Figuren">
        <div v-for="(figure, index) in task.figures" :key="index" class="run__slot">
          <span class="sr-only">Figur {{ index + 1 }}</span>
          <span class="run__figure" v-html="figure" />
        </div>
        <div class="run__slot run__slot--open">
          <span class="num run__ask" aria-hidden="true">?</span>
          <span class="sr-only">Figur {{ task.figures.length + 1 }}, gesucht</span>
        </div>
      </div>

      <p class="run__hint" role="status">
        <span v-if="feedback && hit">✓ richtig</span>
        <span v-else-if="feedback">✗ die markierte Figur setzt die Reihe fort</span>
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

.run__row {
  display: flex;
  gap: 1px;
  padding: 1px;
  overflow: hidden;
  background-color: var(--rule);
}

.run__slot {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  aspect-ratio: 1;
  align-items: center;
  justify-content: center;
  padding: 0.3125rem;
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

.run__slot :deep(svg) {
  width: 100%;
  height: 100%;
}

.run__slot--open {
  background-color: var(--sunken);
}

.run__ask {
  font-size: 1.5rem;
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
