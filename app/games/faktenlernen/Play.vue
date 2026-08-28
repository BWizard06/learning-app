<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ChoiceOption } from '~~/shared/types'
import type { GameFinishPayload } from '~/composables/useGameSession'
import type { FactsPayload } from './generator'
import definition from './definition'

type Phase = 'lernen' | 'ablenkung' | 'abfrage'

const props = defineProps<{ seed: number; difficulty: number; durationS?: number }>()
const emit = defineEmits<{ finish: [GameFinishPayload] }>()

const engine = useEngine({
  definition,
  seed: props.seed,
  startDifficulty: props.difficulty,
  durationS: props.durationS,
})
const { current, feedback } = engine

useGameSession(engine, (payload) => emit('finish', payload))

const phase = ref<Phase>('lernen')
const remaining = ref(0)
const questionIndex = ref(0)
const answers = ref<number[]>([])
const distractionIndex = ref(0)
const summary = ref<{ korrekt: number; gesamt: number } | null>(null)
const busy = ref(false)

let ticker: ReturnType<typeof setInterval> | null = null
let deadline = 0

const task = computed(() => (current.value?.payload ?? null) as FactsPayload | null)
const locked = computed(() => feedback.value !== null)
const questions = computed(() => task.value?.questions ?? [])
const question = computed(() => questions.value[questionIndex.value] ?? null)

const questionOptions = computed<ChoiceOption[]>(() =>
  (question.value?.options ?? []).map((label, index) => ({ id: `antwort-${index}`, label })),
)

const distractionOptions = computed<ChoiceOption[]>(() =>
  (task.value?.distractionOptions ?? []).map((label, index) => ({ id: `zwischen-${index}`, label })),
)

const distractionNumber = computed(() => {
  const numbers = task.value?.distractionNumbers ?? []
  if (numbers.length === 0) return null
  return numbers[distractionIndex.value % numbers.length]!
})

const statusText = computed(() => {
  if (summary.value) return `${summary.value.korrekt} von ${summary.value.gesamt} richtig`
  if (phase.value === 'lernen') return 'Steckbriefe einprägen, danach folgen Fragen dazu'
  if (phase.value === 'ablenkung') return 'Kurze Zwischenaufgabe, gleich geht es weiter'
  return `Frage ${questionIndex.value + 1} von ${questions.value.length}`
})

function stopTicker() {
  if (ticker) clearInterval(ticker)
  ticker = null
}

function runPhase(seconds: number, done: () => void) {
  stopTicker()
  deadline = Date.now() + seconds * 1000
  remaining.value = seconds
  ticker = setInterval(() => {
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
    remaining.value = left
    if (left <= 0) {
      stopTicker()
      done()
    }
  }, 200)
}

function beginRecall() {
  stopTicker()
  remaining.value = 0
  questionIndex.value = 0
  phase.value = 'abfrage'
}

function beginDistraction() {
  if (phase.value !== 'lernen') return
  phase.value = 'ablenkung'
  distractionIndex.value = 0
  runPhase(task.value?.distractionS ?? 20, beginRecall)
}

function beginLearning() {
  summary.value = null
  answers.value = []
  questionIndex.value = 0
  distractionIndex.value = 0
  phase.value = 'lernen'
  runPhase(task.value?.learnS ?? 60, beginDistraction)
}

function answerDistraction() {
  if (phase.value !== 'ablenkung') return
  distractionIndex.value += 1
}

function finishRecall() {
  const expected = (current.value?.answer ?? []) as number[]
  let korrekt = 0
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] === answers.value[i]) korrekt++
  }
  summary.value = { korrekt, gesamt: expected.length }
  engine.submit([...answers.value])
}

function answerQuestion(index: number) {
  if (phase.value !== 'abfrage' || locked.value || busy.value) return
  busy.value = true
  answers.value = [...answers.value, index]
  if (questionIndex.value + 1 < questions.value.length) questionIndex.value += 1
  else finishRecall()
  nextTick(() => {
    busy.value = false
  })
}

onMounted(() => {
  engine.start()
  beginLearning()
})

onBeforeUnmount(() => {
  stopTicker()
  engine.dispose()
})
</script>

<template>
  <GameFrame :engine="engine">
    <div class="run">
      <div class="run__head">
        <p class="eyebrow">
          <span v-if="phase === 'lernen'">Steckbriefe einprägen</span>
          <span v-else-if="phase === 'ablenkung'">Zwischenaufgabe</span>
          <span v-else>Abfrage</span>
        </p>
        <span v-if="phase !== 'abfrage'" class="num run__clock">{{ remaining }} s</span>
        <span v-else class="num run__clock">{{ questionIndex + 1 }} / {{ questions.length }}</span>
      </div>

      <div v-if="task && phase === 'lernen'" class="run__stage">
        <ul class="profiles">
          <li v-for="entry in task.profiles" :key="entry.person" class="card profile">
            <p class="profile__person">{{ entry.person }}</p>
            <dl class="profile__facts">
              <div class="profile__fact">
                <dt class="profile__key">Wohnort</dt>
                <dd class="profile__value">{{ entry.ort }}</dd>
              </div>
              <div class="profile__fact">
                <dt class="profile__key">Beruf</dt>
                <dd class="profile__value">{{ entry.beruf }}</dd>
              </div>
              <div class="profile__fact">
                <dt class="profile__key">Hobby</dt>
                <dd class="profile__value">{{ entry.hobby }}</dd>
              </div>
            </dl>
          </li>
        </ul>
      </div>

      <div v-else-if="task && phase === 'ablenkung'" class="run__stage run__stage--center">
        <p class="run__prompt">{{ task.distractionPrompt }}</p>
        <p class="num run__number">{{ distractionNumber }}</p>
      </div>

      <div v-else-if="task && phase === 'abfrage'" class="run__stage">
        <p class="run__question">{{ question?.text ?? '' }}</p>
      </div>

      <div class="run__foot">
        <p class="run__status" role="status">{{ statusText }}</p>

        <button
          v-if="phase === 'lernen'"
          type="button"
          class="run__next tap"
          @click="beginDistraction"
        >
          Weiter
        </button>

        <ChoiceGrid
          v-else-if="phase === 'ablenkung'"
          :options="distractionOptions"
          :columns="2"
          @select="answerDistraction"
        />

        <ChoiceGrid
          v-else
          :options="questionOptions"
          :columns="1"
          :disabled="locked"
          @select="answerQuestion"
        />
      </div>
    </div>
  </GameFrame>
</template>

<style scoped>
.run {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.run__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-block: 0.25rem 0.75rem;
}

.run__clock {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--muted);
}

.run__stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.run__stage--center {
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.profiles {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.profile {
  padding: 0.5rem 0.75rem;
}

.profile__person {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.profile__facts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.375rem;
  margin: 0.125rem 0 0;
}

.profile__fact {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.profile__key {
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--faint);
}

.profile__value {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 500;
  line-height: 1.25;
  overflow-wrap: anywhere;
  color: var(--ink);
}

.run__prompt {
  font-size: 1.0625rem;
  text-align: center;
  color: var(--muted);
}

.run__number {
  font-size: clamp(3rem, 18vw, 4.5rem);
  font-weight: 600;
  line-height: 1;
}

.run__question {
  padding-block: 1.5rem 0.5rem;
  font-size: clamp(1.375rem, 5.5vw, 1.75rem);
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.run__status {
  min-height: 1.5rem;
  padding-block: 0.5rem 0.625rem;
  font-size: 0.875rem;
  text-align: center;
  color: var(--muted);
}

.run__foot {
  position: sticky;
  bottom: 0;
  margin-top: auto;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
  background-color: var(--paper);
  border-top: 1px solid var(--rule);
}

.run__next {
  display: flex;
  width: 100%;
  min-height: 3.25rem;
  align-items: center;
  justify-content: center;
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--accent-ink);
  background-color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: var(--radius-key);
  box-shadow: var(--shadow-key);
}

.run__next:active {
  transform: translateY(1px);
}
</style>
