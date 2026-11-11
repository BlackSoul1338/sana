import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export type Db = PostgresJsDatabase;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** База или открытая транзакция: сервисы работают с любым из них. */
export type DbLike = Db | Tx;

const pools = new Map<string, { db: Db; sql: postgres.Sql }>();

/** Клиент на postgres.js. prepare: false — совместимо с пулером Supabase в режиме transaction. */
export function createDb(url: string): { db: Db; sql: postgres.Sql } {
  const existing = pools.get(url);
  if (existing) return existing;
  const entry = openDb(url, 10);
  pools.set(url, entry);
  return entry;
}

/** Uncached client; the caller closes it. Workers need one per request: sockets cannot outlive it. */
export function openDb(url: string, max: number): { db: Db; sql: postgres.Sql } {
  const sql = postgres(url, { prepare: false, max, fetch_types: false, onnotice: () => {} });
  return { db: drizzle(sql), sql };
}

export async function closeAllDb() {
  await Promise.all([...pools.values()].map((p) => p.sql.end({ timeout: 5 })));
  pools.clear();
}
