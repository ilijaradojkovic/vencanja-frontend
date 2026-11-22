import { defineConfig } from 'drizzle-kit';

const url = process.env.DIRECT_URL?.trim();
if (!url) {
  throw new Error('DIRECT_URL is not set. Run `npm run db:migrate` from the repository root instead.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './db/migrations',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
