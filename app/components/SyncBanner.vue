<script setup lang="ts">
import { computed } from 'vue'
import { useSyncStore } from '~/stores/sync'

const sync = useSyncStore()

const visible = computed(() => sync.queued > 0)

const message = computed(() => {
  if (sync.state === 'expired') return 'Sitzung abgelaufen. Zum Anmelden tippen.'
  const count = sync.queued
  return count === 1
    ? 'Ein Ergebnis wartet auf die Übertragung.'
    : `${count} Ergebnisse warten auf die Übertragung.`
})

function act() {
  if (sync.state === 'expired') {
    window.location.assign('/')
    return
  }
  void sync.sync()
}
</script>

<template>
  <button v-if="visible" type="button" class="banner tap" @click="act">
    <span class="banner__mark" aria-hidden="true">{{ sync.state === 'expired' ? '!' : '↻' }}</span>
    <span class="banner__text">{{ message }}</span>
  </button>
</template>

<style scoped>
.banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.875rem;
  line-height: 1.4;
  color: var(--ink);
  background-color: var(--gold-soft);
  border: 1px solid var(--gold);
  border-radius: var(--radius-key);
}

.banner__mark {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 1.375rem;
  height: 1.375rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--paper);
  background-color: var(--gold);
  border-radius: 50%;
}
</style>
