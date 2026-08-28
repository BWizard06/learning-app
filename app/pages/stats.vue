<script setup lang="ts">
import { computed } from 'vue'
import { CONSTRUCT_LABELS } from '~~/shared/types'
import type { StatsPayload } from '~~/server/services/stats'

useHead({ title: 'Statistik' })

const { data, pending, error } = await useFetch<StatsPayload>('/api/stats')

const constructsWithData = computed(() => data.value?.constructs ?? [])

const radarAxes = computed(() =>
  constructsWithData.value.map((entry) => ({ label: entry.shortLabel, note: entry.note })),
)

const radarUsable = computed(() => radarAxes.value.length >= 3)

const missingLabels = computed(() =>
  (data.value?.coverage.missing ?? []).map((construct) => CONSTRUCT_LABELS[construct]),
)

function seriesFor(construct: string) {
  return data.value?.history.series.find((entry) => entry.construct === construct)?.values ?? []
}

function noteText(note: number | null): string {
  return note === null ? '—' : note.toFixed(1).replace('.', ',')
}

function msText(ms: number | null): string {
  if (ms === null) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(1).replace('.', ',')} s` : `${ms} ms`
}

function percentText(value: number): string {
  return `${Math.round(value * 100)} %`
}

function hourText(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

function trendOf(entry: { note: number | null; previousNote: number | null }): string {
  if (entry.note === null || entry.previousNote === null) return ''
  const delta = entry.note - entry.previousNote
  if (Math.abs(delta) < 0.05) return 'gleichbleibend'
  return `${delta > 0 ? 'aufwärts' : 'abwärts'} um ${Math.abs(delta).toFixed(1).replace('.', ',')}`
}
</script>

<template>
  <div class="shell stats">
    <header class="stats__head">
      <NuxtLink to="/" class="stats__back">Zurück</NuxtLink>
      <p class="eyebrow">Statistik</p>
      <h1 class="stats__title">Wo du stehst</h1>
    </header>

    <p v-if="pending" class="stats__state">Wird geladen</p>
    <p v-else-if="error" class="stats__state">Statistik nicht verfügbar.</p>

    <template v-else-if="data">
      <section class="card stats__summary">
        <div>
          <p class="stats__label">Streak</p>
          <p class="num stats__value">{{ data.streak.current }}</p>
          <p class="stats__sub">Rekord {{ data.streak.longest }}</p>
        </div>
        <div>
          <p class="stats__label">Durchgänge</p>
          <p class="num stats__value">{{ data.totals.sessions }}</p>
          <p class="stats__sub">an {{ data.totals.days }} Tagen</p>
        </div>
        <div>
          <p class="stats__label">Minuten</p>
          <p class="num stats__value">{{ Math.round(data.totals.minutes) }}</p>
          <p class="stats__sub">insgesamt</p>
        </div>
      </section>

      <section class="stats__section">
        <h2 class="stats__heading">Konstrukte</h2>
        <div class="card stats__radar">
          <ConstructRadar v-if="radarUsable" :axes="radarAxes" />
          <div v-else class="stats__bands">
            <ScoreBand
              v-for="entry in constructsWithData"
              :key="entry.construct"
              :note="entry.note"
              :label="entry.label"
              :show-source="false"
            />
          </div>
          <p class="stats__caption">
            {{ radarUsable ? 'Der gestrichelte Ring ist die Bestehensgrenze bei 4,0.' : 'Ab drei trainierten Konstrukten erscheint hier das Radar.' }}
          </p>
        </div>
      </section>

      <section class="stats__section">
        <h2 class="stats__heading">Verlauf</h2>
        <article v-for="entry in constructsWithData" :key="entry.construct" class="card stats__trend">
          <div class="stats__trend-head">
            <span class="stats__trend-name">{{ entry.label }}</span>
            <span class="num stats__trend-note" :class="entry.note !== null && entry.note >= 4 ? 'is-pass' : 'is-fail'">
              {{ noteText(entry.note) }}
            </span>
          </div>
          <NoteSparkline :values="seriesFor(entry.construct)" />
          <p class="stats__trend-meta">
            <span class="num">{{ entry.sessions }}</span> Durchgänge
            <template v-if="trendOf(entry)">, {{ trendOf(entry) }}</template>
            <template v-if="entry.noteSource">
              , {{ entry.noteSource === 'personal' ? 'persönliche Normierung' : 'Startschwellen' }}
            </template>
          </p>
        </article>
      </section>

      <section v-if="data.weaknesses.length" class="stats__section">
        <h2 class="stats__heading">Schwachstellen</h2>
        <ul class="card stats__weak">
          <li v-for="row in data.weaknesses.slice(0, 8)" :key="`${row.gameSlug}-${row.itemType}`" class="stats__weak-row">
            <span class="stats__weak-type">{{ row.itemType }}</span>
            <span class="stats__weak-game">{{ row.gameName }}</span>
            <span class="num stats__weak-acc">{{ percentText(row.accuracy) }}</span>
            <span class="num stats__weak-rt">{{ msText(row.meanRtMs) }}</span>
            <span class="num stats__weak-n">{{ row.trials }}×</span>
          </li>
        </ul>
        <p class="stats__caption stats__caption--left">
          Sortiert nach Handlungsbedarf aus Trefferquote und mittlerer Reaktionszeit. Erst ab zwölf
          Aufgaben eines Typs.
        </p>
      </section>

      <section v-if="data.reaction" class="stats__section">
        <h2 class="stats__heading">Reaktionszeit</h2>
        <div class="card stats__reaction">
          <div>
            <p class="stats__label">Median</p>
            <p class="num stats__value">{{ msText(data.reaction.medianMs) }}</p>
          </div>
          <div>
            <p class="stats__label">Streuung</p>
            <p class="num stats__value">{{ msText(data.reaction.spreadMs) }}</p>
            <p class="stats__sub">mittlere Hälfte</p>
          </div>
          <div>
            <p class="stats__label">Konstanz</p>
            <p class="num stats__value">{{ data.reaction.variation.toFixed(2).replace('.', ',') }}</p>
            <p class="stats__sub">kleiner ist stetiger</p>
          </div>
        </div>
      </section>

      <section v-if="data.hours.length > 1" class="stats__section">
        <h2 class="stats__heading">Nach Uhrzeit</h2>
        <ul class="card stats__hours">
          <li v-for="row in data.hours" :key="row.hour" class="stats__hour">
            <span class="num stats__hour-time">{{ hourText(row.hour) }}</span>
            <span class="stats__hour-bar">
              <span
                class="stats__hour-fill"
                :style="{ width: `${row.meanNote ? ((Math.min(6, Math.max(1, row.meanNote)) - 1) / 5) * 100 : 0}%` }"
              />
            </span>
            <span class="num stats__hour-note">{{ noteText(row.meanNote) }}</span>
            <span class="num stats__hour-count">{{ row.sessions }}×</span>
          </li>
        </ul>
        <p class="stats__caption stats__caption--left">
          Die echte Prüfung beginnt um 17:30. Wenn deine Leistung abends abfällt, ist das der Grund,
          abends zu üben.
        </p>
      </section>

      <section v-if="data.weekly.length" class="stats__section">
        <h2 class="stats__heading">Minuten pro Woche</h2>
        <div class="card stats__weekly">
          <WeeklyBars :weeks="data.weekly" />
        </div>
      </section>

      <section class="stats__section">
        <h2 class="stats__heading">Spiele</h2>
        <ul class="card stats__games">
          <li v-for="game in data.games" :key="game.slug" class="stats__game">
            <span class="stats__game-name">{{ game.name }}</span>
            <span class="num stats__game-note">{{ noteText(game.lastNote) }}</span>
            <span class="num stats__game-count">{{ game.sessions }}×</span>
          </li>
        </ul>
      </section>

      <section class="stats__disclaimer">
        <p>
          Die Note ist ein eigener Richtwert dieser App und sagt nichts über dein tatsächliches
          Ergebnis an der ZHAW voraus.
        </p>
        <p v-if="missingLabels.length">
          Nicht abgedeckt sind zurzeit: {{ missingLabels.join(', ') }}. Solange diese Teile fehlen,
          bildet die App die Prüfung nicht vollständig ab.
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.stats {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  padding-block: 2rem 3rem;
}

.stats__back {
  font-size: 0.875rem;
  color: var(--muted);
  text-decoration: none;
}

.stats__title {
  margin-top: 0.375rem;
  font-size: 1.75rem;
}

.stats__head .eyebrow {
  margin-top: 0.75rem;
  display: block;
}

.stats__state {
  color: var(--muted);
}

.stats__summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  padding: 1rem;
}

.stats__label {
  font-size: 0.6875rem;
  color: var(--faint);
}

.stats__value {
  font-size: 1.625rem;
  font-weight: 600;
  line-height: 1.1;
}

.stats__sub {
  font-size: 0.6875rem;
  color: var(--faint);
}

.stats__section {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.stats__heading {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--muted);
}

.stats__radar,
.stats__weekly {
  padding: 1.25rem 1rem 1rem;
}

.stats__bands {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.stats__caption {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  text-align: center;
  color: var(--faint);
}

.stats__caption--left {
  margin-top: 0.25rem;
  text-align: left;
  line-height: 1.45;
}

.stats__weak,
.stats__hours {
  margin: 0;
  padding: 0.375rem 1rem;
  list-style: none;
}

.stats__weak-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  grid-template-areas:
    'type acc rt'
    'game n n';
  gap: 0.125rem 0.625rem;
  padding-block: 0.625rem;
  border-bottom: 1px solid var(--rule);
}

.stats__weak-row:last-child {
  border-bottom: 0;
}

.stats__weak-type {
  grid-area: type;
  font-size: 0.9375rem;
  font-weight: 600;
}

.stats__weak-game {
  grid-area: game;
  font-size: 0.75rem;
  color: var(--faint);
}

.stats__weak-acc {
  grid-area: acc;
  font-weight: 600;
}

.stats__weak-rt {
  grid-area: rt;
  min-width: 3.5rem;
  text-align: right;
  font-size: 0.8125rem;
  color: var(--muted);
}

.stats__weak-n {
  grid-area: n;
  font-size: 0.75rem;
  text-align: right;
  color: var(--faint);
}

.stats__reaction {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  padding: 1rem;
}

.stats__hour {
  display: grid;
  grid-template-columns: 3rem 1fr 2.5rem 2rem;
  align-items: center;
  gap: 0.5rem;
  padding-block: 0.4375rem;
  font-size: 0.8125rem;
}

.stats__hour-bar {
  height: 0.5rem;
  background-color: var(--sunken);
  border-radius: 3px;
  overflow: hidden;
}

.stats__hour-fill {
  display: block;
  height: 100%;
  background-color: var(--accent);
}

.stats__hour-note {
  text-align: right;
  font-weight: 600;
}

.stats__hour-count {
  text-align: right;
  color: var(--faint);
}

.stats__trend {
  padding: 0.875rem 1rem 1rem;
}

.stats__trend-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.stats__trend-name {
  font-size: 0.9375rem;
  font-weight: 600;
}

.stats__trend-note {
  font-size: 1.25rem;
  font-weight: 600;
}

.stats__trend-note.is-pass {
  color: var(--pass);
}

.stats__trend-note.is-fail {
  color: var(--fail);
}

.stats__trend-meta {
  margin-top: 0.625rem;
  font-size: 0.75rem;
  color: var(--faint);
}

.stats__games {
  margin: 0;
  padding: 0.375rem 1rem;
  list-style: none;
}

.stats__game {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.75rem;
  align-items: baseline;
  padding-block: 0.625rem;
  border-bottom: 1px solid var(--rule);
}

.stats__game:last-child {
  border-bottom: 0;
}

.stats__game-name {
  font-size: 0.9375rem;
}

.stats__game-note {
  font-weight: 600;
}

.stats__game-count {
  min-width: 2.5rem;
  font-size: 0.8125rem;
  text-align: right;
  color: var(--faint);
}

.stats__disclaimer {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--muted);
  border: 1px solid var(--rule);
  border-radius: var(--radius-card);
}
</style>
