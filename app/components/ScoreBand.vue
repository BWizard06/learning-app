<script setup lang="ts">
import { computed } from 'vue'
import type { NoteSource } from '~~/shared/types'

const props = withDefaults(
  defineProps<{
    note: number | null
    source?: NoteSource
    label?: string
    compact?: boolean
    showSource?: boolean
  }>(),
  { source: 'thresholds', compact: false, showSource: true },
)

const ticks = [1, 2, 3, 4, 5, 6]

function positionOf(value: number): number {
  const clamped = Math.min(6, Math.max(1, value))
  return ((clamped - 1) / 5) * 100
}

const markerLeft = computed(() => (props.note === null ? null : positionOf(props.note)))
const passed = computed(() => props.note !== null && props.note >= 4)
const noteText = computed(() => (props.note === null ? '—' : props.note.toFixed(1).replace('.', ',')))
const sourceText = computed(() =>
  props.source === 'personal' ? 'persönliche Normierung' : 'Startschwellen',
)
</script>

<template>
  <div class="scoreband" :class="{ 'scoreband--compact': compact }">
    <div v-if="label || !compact" class="scoreband__head">
      <span class="eyebrow">{{ label ?? 'Note' }}</span>
      <span class="num scoreband__value" :class="passed ? 'is-pass' : 'is-fail'">{{ noteText }}</span>
    </div>

    <div class="scoreband__track" role="img" :aria-label="`Note ${noteText} von 6, Bestehensgrenze 4,0`">
      <div class="scoreband__rule" />
      <div v-for="tick in ticks" :key="tick" class="scoreband__tick" :style="{ left: `${positionOf(tick)}%` }" />
      <div class="scoreband__pass" :style="{ left: `${positionOf(4)}%` }" />
      <div
        v-if="markerLeft !== null"
        class="scoreband__marker"
        :class="passed ? 'is-pass' : 'is-fail'"
        :style="{ left: `${markerLeft}%` }"
      />
    </div>

    <div class="scoreband__scale num">
      <span v-for="tick in ticks" :key="tick" :class="{ 'is-pass-label': tick === 4 }">{{ tick }}</span>
    </div>

    <p v-if="showSource && !compact" class="scoreband__source">
      {{ sourceText }}
    </p>
  </div>
</template>

<style scoped>
.scoreband {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.scoreband__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.scoreband__value {
  font-size: 2rem;
  font-weight: 600;
  line-height: 1;
}

.scoreband__value.is-pass {
  color: var(--pass);
}

.scoreband__value.is-fail {
  color: var(--fail);
}

.scoreband__track {
  position: relative;
  height: 1.75rem;
}

.scoreband__rule {
  position: absolute;
  inset-inline: 0;
  top: 50%;
  height: 2px;
  transform: translateY(-50%);
  background-color: var(--rule);
  border-radius: 2px;
}

.scoreband__tick {
  position: absolute;
  top: 50%;
  width: 1px;
  height: 0.5rem;
  transform: translate(-50%, -50%);
  background-color: var(--rule);
}

.scoreband__pass {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-50%);
  background-color: var(--ink);
}

.scoreband__pass::after {
  content: '4,0';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 0.125rem;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: var(--muted);
  white-space: nowrap;
}

.scoreband--compact .scoreband__pass::after {
  content: none;
}

.scoreband__marker {
  position: absolute;
  top: 50%;
  width: 0.875rem;
  height: 0.875rem;
  transform: translate(-50%, -50%) rotate(45deg);
  border-radius: 3px;
  border: 2px solid var(--paper);
}

.scoreband__marker.is-pass {
  background-color: var(--pass);
}

.scoreband__marker.is-fail {
  background-color: var(--fail);
}

.scoreband__scale {
  position: relative;
  display: flex;
  justify-content: space-between;
  font-size: 0.6875rem;
  color: var(--faint);
}

.scoreband__scale .is-pass-label {
  color: var(--ink);
  font-weight: 600;
}

.scoreband__source {
  font-size: 0.75rem;
  color: var(--faint);
}

.scoreband--compact .scoreband__track {
  height: 1rem;
}
</style>
