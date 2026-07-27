import { Client } from 'pg';

export interface ActiveConnection {
  pid: number;
  applicationName: string;
  clientAddr: string | null;
  state: string | null;
  queryStart: string | null;
}

// The live Electron app + its Express backend likely still hold an open pg
// Pool. DDL migrations need ACCESS EXCLUSIVE locks and a live pg_dump can
// itself block behind those, so callers must confirm the app is closed
// before backup/upgrade rather than discovering a hang mid-session.
export async function getOtherActiveConnections(client: Client, databaseName: string): Promise<ActiveConnection[]> {
  const res = await client.query(
    `SELECT pid, application_name, client_addr::text AS client_addr, state, query_start::text AS query_start
     FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [databaseName]
  );
  return res.rows.map((r) => ({
    pid: r.pid,
    applicationName: r.application_name,
    clientAddr: r.client_addr,
    state: r.state,
    queryStart: r.query_start,
  }));
}
