<script setup lang="ts">
import { computed } from 'vue'
import { CONSTRUCT_LABELS } from '~~/shared/types'
import { CONSTRUCT_ORDER, games } from '~/games'

useHead({ title: 'Training' })

const grouped = computed(() =>
  CONSTRUCT_ORDER.map((construct) => ({
    construct,
    label: CONSTRUCT_LABELS[construct],
    entries: games.filter((game) => game.construct === construct),
  })).filter((group) => group.entries.length > 0),
)
</script>

<template>
  <div class="shell home">
    <header class="home__head">
      <p class="eyebrow">Kognitives Training</p>
      <h1 class="home__title">Was übst du heute?</h1>
      <NuxtLink to="/stats" class="home__stats tap">Statistik</NuxtLink>
    </header>

    <section v-for="group in grouped" :key="group.construct" class="home__group">
      <h2 class="home__construct">{{ group.label }}</h2>
      <ul class="home__list">
        <li v-for="game in group.entries" :key="game.slug">
          <NuxtLink :to="`/play/${game.slug}`" class="card home__card tap">
            <span class="home__name">{{ game.name }}</span>
            <span class="home__blurb">{{ game.blurb }}</span>
            <span class="num home__meta">{{ Math.round(game.defaultDurationS / 60) }} min</span>
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.home {
  padding-block: 2.5rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.home__head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.375rem;
}

.home__title {
  font-size: 1.75rem;
}

.home__stats {
  display: inline-flex;
  align-items: center;
  margin-top: 0.5rem;
  padding: 0.5rem 0.875rem;
  font-size: 0.875rem;
  color: var(--ink);
  text-decoration: none;
  border: 1px solid var(--rule);
  border-radius: var(--radius-key);
}

.home__group {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.home__construct {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--muted);
}

.home__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.home__card {
  position: relative;
  display: grid;
  gap: 0.1875rem;
  padding: 0.9375rem 3.75rem 0.9375rem 1rem;
  color: inherit;
  text-decoration: none;
}

.home__name {
  font-size: 1.0625rem;
  font-weight: 600;
}

.home__blurb {
  font-size: 0.875rem;
  line-height: 1.4;
  color: var(--muted);
}

.home__meta {
  position: absolute;
  top: 1rem;
  right: 1rem;
  font-size: 0.75rem;
  color: var(--faint);
}
</style>
