<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ChoiceOption } from '~~/shared/types'
import type { GameFinishPayload } from '~/composables/useGameSession'
import type { EstimatePayload } from './generator'
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

const task = computed(() => (current.value?.payload ?? null) as EstimatePayload | null)
const options = computed<ChoiceOption[]>(() => current.value?.options ?? [])
const locked = computed(() => feedback.value !== null)
const revealIndex = computed(() => (feedback.value ? Number(feedback.value.expected) : null))
const hit = computed(() => feedback.value?.correct === true)
const solution = computed(() =>
  revealIndex.value === null ? '' : (options.value[revealIndex.value]?.label ?? ''),
)
const long = computed(() => (task.value?.expression.length ?? 0) > 20)

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

      <div class="run__task card">
        <p v-if="task" class="num run__expression" :class="{ 'is-long': long }">
          {{ task.expression }}
        </p>
      </div>

      <p class="run__hint" role="status">
        <span v-if="feedback && hit">✓ richtig</span>
        <span v-else-if="feedback">✗ richtig wäre <span class="num">{{ solution }}</span></span>
        <span v-else>&nbsp;</span>
      </p>

      <div class="run__choices">
        <ChoiceGrid
          :options="options"
          :columns="1"
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
  padding-block: 0.25rem 0.625rem;
}

.run__task {
  display: flex;
  min-height: 6rem;
  align-items: center;
  justify-content: center;
  padding: 1rem 1.125rem;
  text-align: center;
}

.run__expression {
  font-size: clamp(1.5rem, 7.5vw, 2.25rem);
  font-weight: 600;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.run__expression.is-long {
  font-size: clamp(1.0625rem, 5vw, 1.5rem);
}

.run__hint {
  min-height: 1.75rem;
  padding-block: 0.625rem 0.5rem;
  font-size: 0.875rem;
  text-align: center;
  color: var(--muted);
}

.run__choices {
  margin-top: auto;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}

.run__choices :deep(.choice) {
  min-height: 3.25rem;
  padding-inline: 2.25rem;
}

.run__choices :deep(.choice__label) {
  font-family: var(--font-mono);
  font-size: 1.25rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
</style>
