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
  console.error(err);
  process.exit(1);
});
