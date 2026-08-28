<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ weeks: { week: string; minutes: number; sessions: number }[] }>()

const max = computed(() => Math.max(1, ...props.weeks.map((week) => week.minutes)))

function label(week: string): string {
  return week.split('-W')[1] ?? week
}
</script>

<template>
  <div class="bars">
    <div v-for="week in weeks" :key="week.week" class="bars__item">
      <div class="bars__track">
        <div
          class="bars__fill"
          :style="{ height: `${Math.max(2, (week.minutes / max) * 100)}%` }"
          :title="`${week.minutes} Minuten`"
        />
      </div>
      <span class="num bars__label">{{ label(week.week) }}</span>
    </div>
  </div>
</template>

<style scoped>
.bars {
  display: flex;
  align-items: flex-end;
  gap: 0.25rem;
  height: 5.5rem;
}

.bars__item {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.25rem;
  height: 100%;
}

.bars__track {
  display: flex;
  flex: 1;
  align-items: flex-end;
  background-color: var(--sunken);
  border-radius: 3px;
}

.bars__fill {
  width: 100%;
  background-color: var(--accent);
  border-radius: 3px;
}

.bars__label {
  font-size: 0.5625rem;
  color: var(--faint);
  text-align: center;
}
</style>
