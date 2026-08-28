<script setup lang="ts">
import { computed } from 'vue'
import { movingAverage } from '~~/shared/series'

const props = withDefaults(
  defineProps<{ values: (number | null)[]; window?: number; height?: number }>(),
  { window: 7, height: 56 },
)

const WIDTH = 300

const smoothed = computed(() => movingAverage(props.values, props.window))

function yOf(note: number): number {
  const clamped = Math.min(6, Math.max(1, note))
  return props.height - ((clamped - 1) / 5) * props.height
}

function xOf(index: number): number {
  const span = Math.max(1, props.values.length - 1)
  return (index / span) * WIDTH
}

const path = computed(() => {
  const segments: string[] = []
  let open = false
  smoothed.value.forEach((value, index) => {
    if (value === null) {
      open = false
      return
    }
    segments.push(`${open ? 'L' : 'M'}${xOf(index).toFixed(1)} ${yOf(value).toFixed(1)}`)
    open = true
  })
  return segments.join(' ')
})

const points = computed(() =>
  props.values
    .map((value, index) => ({ value, index }))
    .filter((entry): entry is { value: number; index: number } => entry.value !== null)
    .map((entry) => ({ x: xOf(entry.index), y: yOf(entry.value) })),
)

const hasData = computed(() => points.value.length > 0)
</script>

<template>
  <svg
    class="spark"
    :viewBox="`0 0 ${WIDTH} ${height}`"
    preserveAspectRatio="none"
    role="img"
    aria-label="Notenverlauf mit gleitendem Mittel"
  >
    <line x1="0" :y1="yOf(4)" :x2="WIDTH" :y2="yOf(4)" class="spark__pass" />
    <line x1="0" :y1="yOf(1)" :x2="WIDTH" :y2="yOf(1)" class="spark__base" />
    <path v-if="hasData" :d="path" class="spark__line" />
    <circle v-for="(point, i) in points" :key="i" :cx="point.x" :cy="point.y" r="1.6" class="spark__dot" />
  </svg>
</template>

<style scoped>
.spark {
  display: block;
  width: 100%;
  height: v-bind('`${height}px`');
  overflow: visible;
}

.spark__pass {
  stroke: var(--ink);
  stroke-width: 1;
  stroke-dasharray: 3 3;
  vector-effect: non-scaling-stroke;
}

.spark__base {
  stroke: var(--rule);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.spark__line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.spark__dot {
  fill: var(--faint);
}
</style>
