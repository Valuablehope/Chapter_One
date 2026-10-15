// Type-only imports of `pg` are erased; this exists so a stray runtime import does not break the bundle.
export class Pool { constructor() { throw new Error('pg is not available on device; use PglitePool'); } }
export class Client { constructor() { throw new Error('pg is not available on device'); } }
export default { Pool, Client };
