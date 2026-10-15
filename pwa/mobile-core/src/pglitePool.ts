import type { PGlite } from '@electric-sql/pglite';

/**
 * A drop-in replacement for the `pg` Pool that the backend models import from
 * config/database. It exposes only the surface the models use:
 *   pool.query(text, params) and pool.connect() -> { query, release }.
 *
 * PGlite is one connection. A real pg pool hands models a second connection when they call
 * pool.query() while a transaction is open on another client; here every caller shares the
 * single connection, so a model's lookups inside its own transaction simply join it.
 * To stop two *requests* interleaving, serialize whole requests with runExclusive().
 */
export interface PoolResult<T = any> {
  rows: T[];
  rowCount: number;
  fields?: { name: string }[];
}

export class PglitePool {
  private tail: Promise<unknown> = Promise.resolve();

  private db!: PGlite;

  constructor(db?: PGlite) {
    if (db) this.db = db;
  }

  /** Attach the database once it has been opened and migrated. */
  attach(db: PGlite): void {
    this.db = db;
  }

  /** Run one logical request (a whole API call or background job) with the database to itself. */
  runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn, fn);
    this.tail = run.catch(() => undefined);
    return run;
  }

  async query<T = any>(text: string, params?: any[]): Promise<PoolResult<T>> {
    const r = await this.db.query<T>(text, params);
    // `pg` reports rows returned for SELECT/RETURNING and rows affected for plain writes.
    const affected = r.affectedRows ?? 0;
    return { rows: r.rows, rowCount: affected > 0 ? affected : r.rows.length, fields: r.fields as any };
  }

  async connect() {
    return {
      query: <T = any>(text: string, params?: any[]) => this.query<T>(text, params),
      release: () => undefined,
    };
  }

  async end(): Promise<void> {
    await this.db.close();
  }

  // The backend's health monitor reads these off a pg Pool.
  get totalCount() { return 1; }
  get idleCount() { return 1; }
  get waitingCount() { return 0; }
  on(): this { return this; }
}
