import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'

let instance: BetterSQLite3Database<typeof schema> | null = null
let connection: Database.Database | null = null

export function createConnection(dbPath: string): Database.Database {
  const absolute = resolve(dbPath)
  mkdirSync(dirname(absolute), { recursive: true })
  const sqlite = new Database(absolute)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  return sqlite
}

export function useDb(): BetterSQLite3Database<typeof schema> {
  if (instance) return instance
  const config = useRuntimeConfig()
  connection = createConnection(config.dbPath)
  instance = drizzle(connection, { schema })
  migrate(instance, { migrationsFolder: resolve(config.migrationsDir) })
  return instance
}

export function useSqlite(): Database.Database {
  if (!connection) useDb()
  return connection!
}

export function createTestDb(): {
  db: BetterSQLite3Database<typeof schema>
  sqlite: Database.Database
} {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: resolve('./server/db/migrations') })
  return { db, sqlite }
}

export { schema }
