import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const games = sqliteTable('games', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  construct: text('construct').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    gameSlug: text('game_slug').notNull(),
    startedAt: integer('started_at').notNull(),
    finishedAt: integer('finished_at'),
    durationMs: integer('duration_ms').notNull(),
    difficulty: real('difficulty').notNull(),
    rawScore: real('raw_score').notNull(),
    accuracy: real('accuracy').notNull(),
    note: real('note'),
    noteSource: text('note_source'),
    seed: integer('seed').notNull(),
    mode: text('mode').notNull(),
    metricsJson: text('metrics_json').notNull().default('{}'),
    deviceId: text('device_id'),
    createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
    syncedAt: integer('synced_at'),
  },
  (table) => [
    index('idx_sessions_game_started').on(table.gameSlug, table.startedAt),
    index('idx_sessions_started').on(table.startedAt),
  ],
)

export const trials = sqliteTable(
  'trials',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    idx: integer('idx').notNull(),
    itemType: text('item_type').notNull(),
    difficulty: real('difficulty').notNull(),
    itemJson: text('item_json').notNull(),
    responseJson: text('response_json'),
    correct: integer('correct', { mode: 'boolean' }).notNull(),
    rtMs: integer('rt_ms').notNull(),
    presentedAt: integer('presented_at').notNull(),
  },
  (table) => [
    index('idx_trials_session').on(table.sessionId),
    index('idx_trials_item_type').on(table.itemType),
  ],
)

export const dayLog = sqliteTable('day_log', {
  date: text('date').primaryKey(),
  sessionsCount: integer('sessions_count').notNull().default(0),
  minutes: real('minutes').notNull().default(0),
  meanNote: real('mean_note'),
  constructsJson: text('constructs_json').notNull().default('{}'),
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const planDays = sqliteTable('plan_days', {
  date: text('date').primaryKey(),
  prescribedJson: text('prescribed_json').notNull(),
  completedJson: text('completed_json').notNull().default('[]'),
})

export const examRuns = sqliteTable('exam_runs', {
  id: text('id').primaryKey(),
  startedAt: integer('started_at').notNull(),
  finishedAt: integer('finished_at'),
  partNotesJson: text('part_notes_json').notNull().default('{}'),
  passed: integer('passed', { mode: 'boolean' }),
  verdictJson: text('verdict_json').notNull().default('{}'),
  seed: integer('seed').notNull(),
  repeatedSeed: integer('repeated_seed', { mode: 'boolean' }).notNull().default(false),
})
