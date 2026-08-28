export interface Rng {
  readonly seed: number
  next(): number
  int(min: number, max: number): number
  float(min: number, max: number): number
  bool(probability?: number): boolean
  pick<T>(items: readonly T[]): T
  pickIndex(weights: readonly number[]): number
  weighted<T>(entries: readonly (readonly [T, number])[]): T
  shuffle<T>(items: readonly T[]): T[]
  sample<T>(items: readonly T[], count: number): T[]
  sign(): number
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedFromString(value: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function createRng(seed: number | string): Rng {
  const numericSeed = typeof seed === 'string' ? seedFromString(seed) : seed >>> 0
  const next = mulberry32(numericSeed)

  const rng: Rng = {
    seed: numericSeed,

    next,

    int(min, max) {
      if (max < min) throw new RangeError(`int: max ${max} below min ${min}`)
      return min + Math.floor(next() * (max - min + 1))
    },

    float(min, max) {
      return min + next() * (max - min)
    },

    bool(probability = 0.5) {
      return next() < probability
    },

    pick(items) {
      if (items.length === 0) throw new RangeError('pick: empty list')
      return items[Math.floor(next() * items.length)]!
    },

    pickIndex(weights) {
      const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0)
      if (total <= 0) throw new RangeError('pickIndex: weights sum to zero')
      let target = next() * total
      for (let i = 0; i < weights.length; i++) {
        target -= Math.max(0, weights[i]!)
        if (target < 0) return i
      }
      return weights.length - 1
    },

    weighted(entries) {
      if (entries.length === 0) throw new RangeError('weighted: empty list')
      const index = rng.pickIndex(entries.map((entry) => entry[1]))
      return entries[index]![0]
    },

    shuffle(items) {
      const result = items.slice()
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        const tmp = result[i]!
        result[i] = result[j]!
        result[j] = tmp
      }
      return result
    },

    sample(items, count) {
      if (count > items.length) throw new RangeError(`sample: ${count} exceeds ${items.length}`)
      return rng.shuffle(items).slice(0, count)
    },

    sign() {
      return next() < 0.5 ? -1 : 1
    },
  }

  return rng
}
