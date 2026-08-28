import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type * as schema from '../db/schema'

export type Db = BetterSQLite3Database<typeof schema>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
