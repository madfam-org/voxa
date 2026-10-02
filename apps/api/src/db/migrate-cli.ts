import { unwrapDbError } from '../lib/db-errors.js';
import { runMigrations } from './client.js';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  await runMigrations(url);
  console.log('Migrations complete');
}

main().catch((err) => {
  // A DrizzleQueryError message carries the query's bound parameters.
  console.error(unwrapDbError(err));
  process.exit(1);
});
