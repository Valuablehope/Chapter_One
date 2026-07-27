import { Client } from 'pg';
import { DbConfig } from '../types';

// Deliberately does NOT replicate backend/src/scripts/migrate.ts's
// createClientWithRetry fallback-password behavior (which will silently
// ALTER ROLE ... WITH PASSWORD if it connects using a hardcoded fallback
// instead of the configured one). This toolkit connects with exactly the
// configured credentials and fails loudly — a silent credential rotation
// mid-upgrade-procedure would be dangerous, not helpful.
export async function connect(dbConfig: DbConfig, databaseOverride?: string): Promise<Client> {
  const database = databaseOverride ?? dbConfig.database;
  const client = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database,
  });

  try {
    await client.connect();
  } catch (err: any) {
    throw new Error(
      `Failed to connect to PostgreSQL (host=${dbConfig.host} port=${dbConfig.port} user=${dbConfig.user} ` +
        `database=${database}): ${err.message}. This toolkit never tries fallback credentials — ` +
        `fix the configured connection details and retry.`
    );
  }

  return client;
}
