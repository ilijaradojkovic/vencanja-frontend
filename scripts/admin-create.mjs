#!/usr/bin/env node
/**
 * `npm run admin:create -- --email <email> [--password <password>] [--name <name>]`
 *
 * Creates (or repairs) the first superadmin (SPEC §8.4). Local development needs
 * no arguments beyond the email; against a hosted environment it refuses unless
 * ALLOW_ADMIN_CREATE=1 is set explicitly, so a production account is never created
 * by accident.
 */
import { randomInt } from 'node:crypto';

import postgres from 'postgres';

import { fail, isLocalDatabaseUrl, log, logStep, supabaseStatus } from './lib/local-stack.mjs';

const args = process.argv.slice(2);
const valueOf = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const generatePassword = () => {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 12 }, () => alphabet[randomInt(alphabet.length)]).join('');
};

const email = (valueOf('email') ?? '').trim().toLowerCase();
const password = valueOf('password') ?? generatePassword();
const generated = !valueOf('password');
const name = (valueOf('name') ?? 'Uspomena admin').trim();

if (!email || !/^\S+@\S+\.\S+$/.test(email))
  fail('Usage: npm run admin:create -- --email <email> [--password <password>]');
if (password.length < 6) fail('The password must be at least 6 characters.');

logStep('Target environment');
const status = supabaseStatus();
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? status?.API_URL ?? '').replace(
  /\/$/,
  '',
);
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SECRET_KEY ?? status?.SECRET_KEY ?? '';
const databaseUrl = process.env.DATABASE_URL ?? status?.DB_URL ?? '';
const local = isLocalDatabaseUrl(databaseUrl);

if (!supabaseUrl || !serviceKey) fail('Supabase URL and service-role key are required (local stack or hosted env).');
if (!databaseUrl) fail('DATABASE_URL is required.');
if (!local && process.env.ALLOW_ADMIN_CREATE !== '1') {
  fail(
    `Refusing to create a superadmin in ${supabaseUrl}: it is not the local stack. ` +
      'Set ALLOW_ADMIN_CREATE=1 only for an approved non-production environment.',
  );
}
log(`  ${local ? 'Local stack' : 'Hosted project'} ${supabaseUrl}`);

const headers = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' };

logStep('Supabase Auth user');
let userId = null;
const create = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { locale: 'sr', name } }),
});
if (create.ok) {
  userId = (await create.json()).id;
  log('  Created the Auth user.');
} else {
  const body = await create.json().catch(() => ({}));
  if (body.error_code !== 'email_exists' && body.code !== 'email_exists') {
    fail(`Supabase Auth refused the user (${create.status}): ${JSON.stringify(body)}`);
  }
  const list = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, { headers });
  const users = list.ok ? ((await list.json()).users ?? []) : [];
  userId = users.find((user) => String(user.email).toLowerCase() === email)?.id ?? null;
  if (!userId) fail('The email already exists but its Auth user could not be found.');
  const updated = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ password }),
  });
  if (!updated.ok) fail(`Could not set the superadmin password (${updated.status}).`);
  log('  Updated the existing Auth user and its password.');
}

logStep('Profile');
const sql = postgres(databaseUrl, { max: 1, prepare: false });
try {
  await sql`
    insert into profiles (id, role, email, name, locale, onboarded_at)
    values (${userId}, 'superadmin', ${email}, ${name}, 'sr', now())
    on conflict (id) do update set
      role = 'superadmin',
      email = excluded.email,
      name = excluded.name,
      onboarded_at = coalesce(profiles.onboarded_at, now())
  `;
  log('  Superadmin profile is ready.');
} finally {
  await sql.end();
}

logStep('Done');
log(`  Sign in with: ${email}`);
if (generated) log(`  Generated password (shown once): ${password}`);
