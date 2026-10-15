import { PglitePool } from '../pglitePool';

/** Stands in for backend/src/config/database. The real PGlite instance is attached at boot. */
export const pool = new PglitePool();
export function startHealthMonitoring() {}
export function stopHealthMonitoring() {}
export function isPoolHealthy() { return true; }
export default pool;
