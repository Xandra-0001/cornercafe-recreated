import { createPool } from '../src/database/pool.js';
import { runMigrations } from '../src/database/migrations.js';
import { bootstrapInitialOwner } from '../src/services/auth.js';
const pool = createPool(process.env);
try {
  await runMigrations(pool);
  if (!await bootstrapInitialOwner(pool)) throw new Error('An active owner already exists.');
  console.log(JSON.stringify({ event: 'initial_owner_created' }));
} finally {
  await pool.end();
}
