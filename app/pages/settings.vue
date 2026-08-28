<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSyncStore } from '~/stores/sync'
import { games } from '~/games'
import { CONSTRUCT_LABELS, EXAM_CONSTRUCTS } from '~~/shared/types'

useHead({ title: 'Einstellungen' })

const { choice, set } = useTheme()
const sync = useSyncStore()
const deviceId = ref('')

const themes = [
  { value: 'system' as const, label: 'Wie das Gerät' },
  { value: 'light' as const, label: 'Hell' },
  { value: 'dark' as const, label: 'Dunkel' },
]

const covered = computed(() => new Set(games.map((game) => game.construct)))
const missing = computed(() => EXAM_CONSTRUCTS.filter((construct) => !covered.value.has(construct)))

onMounted(() => {
  deviceId.value = useDeviceId()
  void sync.refreshCount()
})
</script>

<template>
  <div class="shell settings">
    <header>
      <NuxtLink to="/" class="settings__back">Zurück</NuxtLink>
      <p class="eyebrow">Einstellungen</p>
      <h1 class="settings__title">Einstellungen</h1>
    </header>

    <section class="settings__section">
      <h2 class="settings__heading">Darstellung</h2>
      <div class="card settings__themes">
        <button
          v-for="theme in themes"
          :key="theme.value"
          type="button"
          class="settings__theme tap"
          :class="{ 'is-active': choice === theme.value }"
          :aria-pressed="choice === theme.value"
          @click="set(theme.value)"
        >
          <span class="settings__theme-mark" aria-hidden="true">{{ choice === theme.value ? '✓' : '' }}</span>
          {{ theme.label }}
        </button>
      </div>
    </section>

    <section class="settings__section">
      <h2 class="settings__heading">Daten</h2>
      <div class="card settings__block">
        <p class="settings__text">
          Es gibt bewusst keine automatischen Sicherungen. Der Verlauf lässt sich jederzeit
          vollständig herunterladen.
        </p>
        <div class="settings__links">
          <a href="/api/export" class="settings__link tap">Alles als JSON</a>
          <a href="/api/export?format=csv&amp;table=sessions" class="settings__link tap">Durchgänge als CSV</a>
          <a href="/api/export?format=csv&amp;table=trials" class="settings__link tap">Einzelaufgaben als CSV</a>
        </div>
      </div>
    </section>

    <section class="settings__section">
      <h2 class="settings__heading">Übertragung</h2>
      <div class="card settings__block">
        <p class="settings__text">
          <template v-if="sync.queued === 0">Alles übertragen, nichts wartet.</template>
          <template v-else>
            <span class="num">{{ sync.queued }}</span>
            {{ sync.queued === 1 ? 'Ergebnis wartet' : 'Ergebnisse warten' }} auf die Übertragung.
          </template>
        </p>
        <p v-if="sync.lastError" class="settings__hint">Zuletzt: {{ sync.lastError }}</p>
        <button type="button" class="settings__link tap" @click="sync.sync()">Jetzt übertragen</button>
      </div>
    </section>

    <section class="settings__section">
      <h2 class="settings__heading">Abdeckung</h2>
      <div class="card settings__block">
        <p class="settings__text">
          <span class="num">{{ games.length }}</span> Spiele über
          <span class="num">{{ covered.size }}</span> Konstrukte.
        </p>
        <p v-if="missing.length" class="settings__hint">
          Ohne Spiel: {{ missing.map((c) => CONSTRUCT_LABELS[c]).join(', ') }}. Diese Prüfungsteile
          brauchen geschriebene Inhalte und fehlen deshalb noch.
        </p>
      </div>
    </section>

    <section class="settings__section">
      <h2 class="settings__heading">Gerät</h2>
      <div class="card settings__block">
        <p class="num settings__device">{{ deviceId }}</p>
        <p class="settings__hint">
          Diese Kennung steht bei jedem Durchgang, damit später erkennbar ist, auf welchem Gerät er
          entstanden ist.
        </p>
      </div>
    </section>

    <p class="settings__note">
      Die Note dieser App ist ein eigener Richtwert und sagt nichts über ein tatsächliches
      ZHAW-Ergebnis voraus.
    </p>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-block: 2rem 3rem;
}

.settings__back {
  font-size: 0.875rem;
  color: var(--muted);
  text-decoration: none;
}

.settings__title {
  margin-top: 0.375rem;
  font-size: 1.75rem;
}

.settings__section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.settings__heading {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--muted);
}

.settings__themes {
  display: flex;
  flex-direction: column;
  padding: 0.25rem 0;
}

.settings__theme {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  font-size: 0.9375rem;
  text-align: left;
  color: var(--ink);
}

.settings__theme.is-active {
  font-weight: 600;
}

.settings__theme-mark {
  width: 1rem;
  font-weight: 700;
  color: var(--accent);
}

.settings__block {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 1rem;
}

.settings__text {
  font-size: 0.9375rem;
  line-height: 1.5;
}

.settings__hint {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--faint);
}

.settings__links {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.settings__link {
  padding: 0.6875rem 0.875rem;
  font-size: 0.875rem;
  text-align: center;
  color: var(--ink);
  text-decoration: none;
  border: 1px solid var(--rule);
  border-radius: var(--radius-key);
}

.settings__device {
  font-size: 0.75rem;
  word-break: break-all;
  color: var(--muted);
}

.settings__note {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--faint);
}
</style>
