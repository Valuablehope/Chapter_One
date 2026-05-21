import { pool } from '../config/database';

async function diagnose() {
  console.log('--- Database Diagnostics ---');
  try {
    // 1. Show database version & settings
    const ver = await pool.query('SELECT version()');
    console.log(`Database Version: ${ver.rows[0].version}`);

    // 2. Show active locks
    const locksQuery = `
      SELECT
        blocked_locks.pid     AS blocked_pid,
        blocked_activity.usename  AS blocked_user,
        blocking_locks.pid    AS blocking_pid,
        blocking_activity.usename AS blocking_user,
        blocked_activity.query    AS blocked_statement,
        blocking_activity.query   AS current_statement_in_blocking_process
      FROM  pg_catalog.pg_locks         blocked_locks
      JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
      JOIN pg_catalog.pg_locks         blocking_locks 
        ON blocking_locks.locktype = blocked_locks.locktype
        AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
        AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
        AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
        AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
        AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
        AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
        AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
        AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
        AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
        AND blocking_locks.pid != blocked_locks.pid
      JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
      WHERE NOT blocked_locks.granted;
    `;
    const locks = await pool.query(locksQuery);
    console.log(`\nActive Blocked Locks: ${locks.rows.length}`);
    locks.rows.forEach((row, i) => {
      console.log(`[${i + 1}] Blocked PID: ${row.blocked_pid} is blocked by Blocking PID: ${row.blocking_pid}`);
      console.log(`   Blocked Statement: ${row.blocked_statement}`);
      console.log(`   Blocking Statement: ${row.current_statement_in_blocking_process}`);
    });

    // 3. Show running queries
    const activityQuery = `
      SELECT pid, state, query, age(clock_timestamp(), query_start) as age
      FROM pg_stat_activity 
      WHERE state != 'idle' AND pid != pg_backend_pid();
    `;
    const activity = await pool.query(activityQuery);
    console.log(`\nActive Connections (excluding idle): ${activity.rows.length}`);
    activity.rows.forEach(row => {
      console.log(`- PID: ${row.pid} | State: ${row.state} | Age: ${row.age} | Query: ${row.query}`);
    });

    // 4. Show idle in transaction connections
    const idleTxQuery = `
      SELECT pid, state, query, age(clock_timestamp(), state_change) as age
      FROM pg_stat_activity 
      WHERE state = 'idle in transaction';
    `;
    const idleTx = await pool.query(idleTxQuery);
    console.log(`\nConnections Idle in Transaction: ${idleTx.rows.length}`);
    idleTx.rows.forEach(row => {
      console.log(`- PID: ${row.pid} | Age: ${row.age} | Query: ${row.query}`);
    });

    // Option to terminate: If any blocked locks or idle in transactions are found, terminate them
    if (idleTx.rows.length > 0 || locks.rows.length > 0) {
      console.log('\nAttempting to terminate blocking/idle-in-transaction connections...');
      const pidsToTerminate = new Set<number>();
      locks.rows.forEach(r => pidsToTerminate.add(r.blocking_pid));
      idleTx.rows.forEach(r => pidsToTerminate.add(r.pid));

      for (const pid of pidsToTerminate) {
        console.log(`Terminating backend process PID ${pid}...`);
        await pool.query('SELECT pg_terminate_backend($1)', [pid]);
      }
      console.log('Termination completed.');
    } else {
      console.log('\nNo blocking or idle-in-transaction processes found.');
    }

  } catch (err) {
    console.error('Error during diagnostics:', err);
  } finally {
    await pool.end();
  }
}

diagnose();
