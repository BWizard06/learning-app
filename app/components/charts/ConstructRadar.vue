<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ axes: { label: string; note: number | null }[] }>()

const SIZE = 240
const CENTER = SIZE / 2
const RADIUS = 82

function pointAt(index: number, note: number): { x: number; y: number } {
  const count = Math.max(1, props.axes.length)
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count
  const clamped = Math.min(6, Math.max(1, note))
  const r = ((clamped - 1) / 5) * RADIUS
  return { x: CENTER + Math.cos(angle) * r, y: CENTER + Math.sin(angle) * r }
}

function ringPath(note: number): string {
  return props.axes
    .map((_, index) => {
      const point = pointAt(index, note)
      return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    })
    .join(' ') + ' Z'
}

const hasData = computed(() => props.axes.some((axis) => axis.note !== null))

const shape = computed(() =>
  props.axes
    .map((axis, index) => {
      const point = pointAt(index, axis.note ?? 1)
      return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    })
    .join(' ') + ' Z',
)

const labels = computed(() =>
  props.axes.map((axis, index) => {
    const point = pointAt(index, 6.9)
    const count = Math.max(1, props.axes.length)
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count
    const anchor = Math.abs(Math.cos(angle)) < 0.3 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end'
    return { ...axis, x: point.x, y: point.y, anchor }
  }),
)
</script>

<template>
  <svg class="radar" :viewBox="`0 0 ${SIZE} ${SIZE}`" role="img" aria-label="Konstrukte im Vergleich, Referenzring bei 4,0">
    <path v-for="note in [2, 3, 5, 6]" :key="note" :d="ringPath(note)" class="radar__ring" />
    <path :d="ringPath(4)" class="radar__pass" />
    <line
      v-for="(axis, index) in axes"
      :key="axis.label"
      :x1="CENTER"
      :y1="CENTER"
      :x2="pointAt(index, 6).x"
      :y2="pointAt(index, 6).y"
      class="radar__spoke"
    />
    <path v-if="hasData" :d="shape" class="radar__shape" />
    <g v-if="hasData">
      <circle
        v-for="(axis, index) in axes"
        :key="axis.label"
        :cx="pointAt(index, axis.note ?? 1).x"
        :cy="pointAt(index, axis.note ?? 1).y"
        r="3"
        class="radar__node"
      />
    </g>
    <text
      v-for="label in labels"
      :key="label.label"
      :x="label.x"
      :y="label.y"
      :text-anchor="label.anchor"
      class="radar__label"
    >
      {{ label.label }}
    </text>
  </svg>
</template>

<style scoped>
.radar {
  display: block;
  width: 100%;
  max-width: 20rem;
  margin-inline: auto;
  overflow: visible;
}

.radar__ring,
.radar__spoke {
  fill: none;
  stroke: var(--rule);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.radar__pass {
  fill: none;
  stroke: var(--ink);
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
  vector-effect: non-scaling-stroke;
}

.radar__shape {
  fill: color-mix(in srgb, var(--accent) 18%, transparent);
  stroke: var(--accent);
  stroke-width: 2;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.radar__node {
  fill: var(--accent);
}

.radar__label {
  font-family: var(--font-sans);
  font-size: 8.5px;
  font-weight: 600;
  fill: var(--muted);
}
</style>
