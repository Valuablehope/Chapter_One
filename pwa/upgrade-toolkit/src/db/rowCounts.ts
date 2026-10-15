import { Client } from 'pg';

export async function getRowCounts(client: Client): Promise<Record<string, number>> {
  const tablesRes = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const counts: Record<string, number> = {};
  for (const row of tablesRes.rows) {
    const tableName = row.table_name as string;
    // information_schema gives us real table names, so this is not
    // user-controlled input — safe to interpolate for the identifier.
    const countRes = await client.query(`SELECT COUNT(*)::bigint AS count FROM "${tableName}"`);
    counts[tableName] = parseInt(countRes.rows[0].count, 10);
  }
  return counts;
}

export async function getDatabaseInfo(client: Client): Promise<{
  version: string;
  majorVersion: number;
  encoding: string;
  collate: string;
  ctype: string;
  sizeBytes: number;
}> {
  const versionRes = await client.query('SHOW server_version_num');
  const versionNum = parseInt(versionRes.rows[0].server_version_num, 10);
  const majorVersion = Math.floor(versionNum / 10000);

  const versionStrRes = await client.query('SELECT version()');
  const version = versionStrRes.rows[0].version as string;

  const dbInfoRes = await client.query(
    `
    SELECT
      pg_encoding_to_char(encoding) AS encoding,
      datcollate AS collate,
      datctype AS ctype,
      pg_database_size(datname) AS size_bytes
    FROM pg_database
    WHERE datname = current_database()
  `
  );
  const row = dbInfoRes.rows[0];

  return {
    version,
    majorVersion,
    encoding: row.encoding,
    collate: row.collate,
    ctype: row.ctype,
    sizeBytes: parseInt(row.size_bytes, 10),
  };
}
