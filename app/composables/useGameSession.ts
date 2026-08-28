import { watch } from 'vue'
import type { TrialResult } from '~~/shared/types'
import type { Engine } from './useEngine'

export interface GameFinishPayload {
  rawScore: number
  accuracy: number
  metrics: Record<string, number>
  durationS: number
  difficulty: number
  seed: number
  trials: TrialResult[]
}

export function useGameSession(engine: Engine, onFinish: (payload: GameFinishPayload) => void) {
  watch(
    () => engine.status.value,
    (status) => {
      if (status !== 'finished' || !engine.outcome.value) return
      const settled = engine.difficultyHistory.length
        ? engine.difficultyHistory.reduce((sum, d) => sum + d, 0) / engine.difficultyHistory.length
        : engine.difficulty.value
      onFinish({
        rawScore: engine.outcome.value.raw,
        accuracy: engine.outcome.value.accuracy,
        metrics: engine.outcome.value.metrics,
        durationS: engine.outcome.value.durationS,
        difficulty: Math.round(settled * 100) / 100,
        seed: engine.seed,
        trials: engine.results.slice() as TrialResult[],
      })
    },
  )
}
