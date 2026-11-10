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
  const sql = postgres(url, { prepare: false, max: 10, onnotice: () => {} });
  const db = drizzle(sql);
  const entry = { db, sql };
  pools.set(url, entry);
  return entry;
}

export async function closeAllDb() {
  await Promise.all([...pools.values()].map((p) => p.sql.end({ timeout: 5 })));
  pools.clear();
}
