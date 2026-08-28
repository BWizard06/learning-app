<script setup lang="ts">
import { computed } from 'vue'
import type { DayPlan } from '~~/server/services/plan'

useHead({ title: 'Tagesplan' })

const { data, pending, error, refresh } = await useFetch<DayPlan>('/api/plan')

const done = computed(() => new Set(data.value?.completed ?? []))
const openMinutes = computed(() =>
  (data.value?.entries ?? [])
    .filter((entry) => !done.value.has(entry.slug))
    .reduce((sum, entry) => sum + entry.minutes, 0),
)

const allDone = computed(
  () => (data.value?.entries.length ?? 0) > 0 && done.value.size >= (data.value?.entries.length ?? 0),
)

function minutesText(minutes: number): string {
  const rounded = Math.round(minutes * 10) / 10
  return `${String(rounded).replace('.', ',')} min`
}
</script>

<template>
  <div class="shell plan">
    <header>
      <NuxtLink to="/" class="plan__back">Zurück</NuxtLink>
      <p class="eyebrow">Tagesplan</p>
      <h1 class="plan__title">Heute vorgeschlagen</h1>
    </header>

    <p v-if="pending" class="plan__state">Wird geladen</p>
    <p v-else-if="error" class="plan__state">Plan nicht verfügbar.</p>

    <template v-else-if="data">
      <p class="plan__lead">
        <template v-if="allDone">Alles erledigt. Alles Weitere ist freiwillig.</template>
        <template v-else>
          Noch <span class="num">{{ minutesText(openMinutes) }}</span> offen, verteilt auf
          <span class="num">{{ data.entries.length - done.size }}</span> Spiele.
        </template>
      </p>

      <ol class="plan__list">
        <li v-for="entry in data.entries" :key="entry.slug">
          <NuxtLink
            :to="`/play/${entry.slug}`"
            class="card plan__item tap"
            :class="{ 'is-done': done.has(entry.slug) }"
          >
            <span class="plan__mark" aria-hidden="true">{{ done.has(entry.slug) ? '✓' : '' }}</span>
            <span class="plan__name">{{ entry.name }}</span>
            <span class="plan__construct">{{ entry.constructLabel }}</span>
            <span class="plan__reason">{{ entry.reason }}</span>
            <span class="num plan__minutes">{{ minutesText(entry.minutes) }}</span>
            <span v-if="done.has(entry.slug)" class="sr-only">erledigt</span>
          </NuxtLink>
        </li>
      </ol>

      <p class="plan__note">
        Der Plan ist ein Vorschlag, kein Zwang. Über die Übersicht erreichst du jederzeit jedes Spiel.
      </p>

      <button type="button" class="plan__refresh tap" @click="refresh()">Aktualisieren</button>
    </template>
  </div>
</template>

<style scoped>
.plan {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-block: 2rem 3rem;
}

.plan__back {
  font-size: 0.875rem;
  color: var(--muted);
  text-decoration: none;
}

.plan__title {
  margin-top: 0.375rem;
  font-size: 1.75rem;
}

.plan__lead {
  color: var(--muted);
}

.plan__state {
  color: var(--muted);
}

.plan__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: plan;
}

.plan__item {
  position: relative;
  display: grid;
  grid-template-columns: 1.5rem 1fr auto;
  grid-template-areas:
    'mark name minutes'
    'mark construct minutes'
    'mark reason reason';
  gap: 0.125rem 0.5rem;
  padding: 0.875rem 1rem;
  color: inherit;
  text-decoration: none;
}

.plan__item.is-done {
  opacity: 0.55;
}

.plan__mark {
  grid-area: mark;
  align-self: center;
  font-size: 1rem;
  font-weight: 700;
  color: var(--pass);
}

.plan__name {
  grid-area: name;
  font-size: 1.0625rem;
  font-weight: 600;
}

.plan__item.is-done .plan__name {
  text-decoration: line-through;
}

.plan__construct {
  grid-area: construct;
  font-size: 0.8125rem;
  color: var(--muted);
}

.plan__reason {
  grid-area: reason;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--faint);
}

.plan__minutes {
  grid-area: minutes;
  align-self: center;
  font-size: 0.8125rem;
  color: var(--faint);
}

.plan__note {
  font-size: 0.8125rem;
  color: var(--faint);
}

.plan__refresh {
  align-self: flex-start;
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  color: var(--muted);
  border: 1px solid var(--rule);
  border-radius: var(--radius-key);
}
</style>
