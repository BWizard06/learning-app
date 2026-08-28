<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Engine } from '~/composables/useEngine'

const props = defineProps<{ engine: Engine; hideFeedback?: boolean }>()

const clock = ref('')
let clockTimer: ReturnType<typeof setInterval> | null = null

function updateClock() {
  clock.value = new Intl.DateTimeFormat('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Zurich',
  }).format(new Date())
}

onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 15000)
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
})

const seconds = computed(() => Math.ceil(props.engine.remainingMs.value / 1000))
const timeText = computed(() => {
  const total = seconds.value
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

const progress = computed(() => {
  const engine = props.engine
  if (engine.total.value > 0) return Math.min(1, engine.index.value / engine.total.value)
  const span = engine.durationS * 1000
  return span > 0 ? Math.min(1, engine.elapsedMs.value / span) : 0
})

const counterText = computed(() =>
  props.engine.total.value > 0
    ? `${props.engine.index.value} / ${props.engine.total.value}`
    : String(props.engine.index.value),
)
</script>

<template>
  <div class="frame">
    <header class="frame__bar">
      <div class="shell frame__row">
        <span class="num frame__clock">{{ clock }}</span>
        <span class="num frame__time">{{ engine.total.value > 0 ? counterText : timeText }}</span>
        <span class="num frame__meta">St. {{ Math.round(engine.difficulty.value) }}</span>
      </div>
      <div class="frame__progress" role="progressbar" :aria-valuenow="Math.round(progress * 100)" aria-valuemin="0" aria-valuemax="100">
        <div class="frame__progress-fill" :style="{ transform: `scaleX(${progress})` }" />
      </div>
    </header>

    <div class="shell frame__body">
      <slot />
    </div>

    <div v-if="!hideFeedback" aria-live="polite" class="sr-only">
      <template v-if="engine.feedback.value">
        {{ engine.feedback.value.correct ? 'Richtig' : 'Falsch' }}
      </template>
    </div>
  </div>
</template>

<style scoped>
.frame {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.frame__bar {
  position: sticky;
  top: 0;
  z-index: 20;
  background-color: color-mix(in srgb, var(--paper) 88%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--rule);
  padding-top: env(safe-area-inset-top);
}

.frame__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-block: 0.625rem;
  font-size: 0.8125rem;
  color: var(--muted);
}

.frame__time {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.frame__progress {
  height: 2px;
  background-color: var(--sunken);
}

.frame__progress-fill {
  height: 100%;
  transform-origin: left center;
  background-color: var(--accent);
  transition: transform 120ms linear;
}

.frame__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-block: 1.25rem 0;
}
</style>
