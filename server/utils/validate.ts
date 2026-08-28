import type { JsonObject, JsonValue, SessionPayload, TrialResult } from '../../shared/types'

const MODES = new Set(['sprint', 'block', 'span', 'reading'])
const MAX_TRIALS = 5000

export class ValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(`${field}: ${message}`)
  }
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(field, 'expected an object')
  }
  return value as Record<string, unknown>
}

function str(source: Record<string, unknown>, field: string, maxLength = 200): string {
  const value = source[field]
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError(field, 'expected a non empty string')
  }
  if (value.length > maxLength) throw new ValidationError(field, `longer than ${maxLength}`)
  return value
}

function num(
  source: Record<string, unknown>,
  field: string,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
): number {
  const value = source[field]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(field, 'expected a finite number')
  }
  if (value < min || value > max) throw new ValidationError(field, `outside ${min}..${max}`)
  return value
}

function int(source: Record<string, unknown>, field: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const value = num(source, field, min, max)
  if (!Number.isInteger(value)) throw new ValidationError(field, 'expected an integer')
  return value
}

function bool(source: Record<string, unknown>, field: string): boolean {
  const value = source[field]
  if (typeof value !== 'boolean') throw new ValidationError(field, 'expected a boolean')
  return value
}

function jsonObject(source: Record<string, unknown>, field: string): JsonObject {
  const value = asRecord(source[field], field)
  const serialised = JSON.stringify(value)
  if (serialised.length > 4000) throw new ValidationError(field, 'payload too large')
  return JSON.parse(serialised) as JsonObject
}

function numberRecord(source: Record<string, unknown>, field: string): Record<string, number> {
  const value = asRecord(source[field] ?? {}, field)
  const result: Record<string, number> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'number' || !Number.isFinite(entry)) {
      throw new ValidationError(`${field}.${key}`, 'expected a finite number')
    }
    result[key] = entry
  }
  return result
}

function parseTrial(raw: unknown, index: number): TrialResult {
  const source = asRecord(raw, `trials[${index}]`)
  return {
    idx: int(source, 'idx', 0, MAX_TRIALS),
    itemType: str(source, 'itemType', 80),
    difficulty: num(source, 'difficulty', -1000, 1000),
    params: jsonObject(source, 'params'),
    response: (source.response ?? null) as JsonValue,
    correct: bool(source, 'correct'),
    rtMs: int(source, 'rtMs', 0, 60 * 60 * 1000),
    presentedAt: int(source, 'presentedAt', 0),
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseSessionPayload(raw: unknown): SessionPayload {
  const source = asRecord(raw, 'body')

  const id = str(source, 'id', 64)
  if (!UUID_PATTERN.test(id)) throw new ValidationError('id', 'expected a uuid')

  const startedAt = int(source, 'startedAt', 0)
  const finishedAt = int(source, 'finishedAt', 0)
  if (finishedAt < startedAt) throw new ValidationError('finishedAt', 'before startedAt')

  const mode = str(source, 'mode', 16)
  if (!MODES.has(mode)) throw new ValidationError('mode', `unknown mode ${mode}`)

  const trialsRaw = source.trials
  if (!Array.isArray(trialsRaw)) throw new ValidationError('trials', 'expected an array')
  if (trialsRaw.length > MAX_TRIALS) throw new ValidationError('trials', 'too many trials')

  return {
    id,
    gameSlug: str(source, 'gameSlug', 64),
    startedAt,
    finishedAt,
    durationMs: int(source, 'durationMs', 0, 6 * 60 * 60 * 1000),
    difficulty: num(source, 'difficulty', -1000, 1000),
    rawScore: num(source, 'rawScore', 0, 1_000_000),
    accuracy: num(source, 'accuracy', 0, 1),
    seed: int(source, 'seed', 0, 0xffffffff),
    mode: mode as SessionPayload['mode'],
    deviceId: str(source, 'deviceId', 64),
    metrics: numberRecord(source, 'metrics'),
    trials: trialsRaw.map(parseTrial),
  }
}
