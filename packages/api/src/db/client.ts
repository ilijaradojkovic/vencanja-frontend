import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { env } from '../env.ts';
import * as schema from './schema.ts';

type DbClient = {
  db: ReturnType<typeof drizzle<typeof schema>>;
  sql: ReturnType<typeof postgres>;
};

let client: DbClient | null = null;

/**
 * One postgres.js pool per server process. `prepare: false` keeps the runtime
 * compatible with the transaction pooler used on Vercel (SPEC §3.3).
 */
const create = (): DbClient => {
  const sql = postgres(env.databaseUrl(), { max: 5, prepare: false });
  return { sql, db: drizzle(sql, { schema }) };
};

export const getDb = (): DbClient['db'] => {
  if (!client) client = create();
  return client.db;
};

export const pingDatabase = async (): Promise<boolean> => {
  try {
    const db = getDb();
    await db.execute('select 1');
    return true;
  } catch {
    return false;
  }
};

/** Closes the pool; used by tests and local scripts. */
export const closeDb = async (): Promise<void> => {
  if (!client) return;
  await client.sql.end({ timeout: 5 });
  client = null;
};
