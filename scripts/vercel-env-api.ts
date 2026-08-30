/**
 * Pushes .env to Vercel over the REST API.
 *
 * The CLI cannot authenticate with a team-scoped access token, so this talks
 * to the API directly. It does two jobs:
 *
 *   1. Upserts the variables production needs, replacing any existing entry so
 *      a half-set value cannot survive.
 *   2. DELETES local-only variables that are actively dangerous in production.
 *      PAYFAST_SKIP_IP_CHECK and PAYFAST_SKIP_SERVER_CONFIRM disable two of
 *      the four checks that stop a forged payment callback being trusted, and
 *      STORE_DRIVER=json would force the ephemeral file store and silently
 *      discard every booking.
 *
 * Usage:
 *   npx tsx scripts/vercel-env-api.ts            dry run
 *   npx tsx scripts/vercel-env-api.ts --apply    write
 *
 * Requires VERCEL_TOKEN, VERCEL_PROJECT_ID and VERCEL_TEAM_ID in the
 * environment. The token is never written to disk or logged.
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import crypto from 'crypto';

const apply = process.argv.includes('--apply');

const TOKEN = process.env.VERCEL_TOKEN ?? '';
const PROJECT = process.env.VERCEL_PROJECT_ID ?? '';
const TEAM = process.env.VERCEL_TEAM_ID ?? '';

if (!TOKEN || !PROJECT || !TEAM) {
  console.error('Set VERCEL_TOKEN, VERCEL_PROJECT_ID and VERCEL_TEAM_ID.');
  process.exit(1);
}

const TARGETS = ['production', 'preview', 'development'];

/** Local-only or actively unsafe in production. Removed if present. */
const REMOVE = new Set([
  'PAYFAST_SKIP_IP_CHECK',
  'PAYFAST_SKIP_SERVER_CONFIRM',
  'STORE_DRIVER',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'DATA_DIR',
  'PORT',
  'EMAIL_REDIRECT_TO',
  'API_URL',
]);

/** Read .env directly rather than process.env, to avoid inherited values. */
function readEnvFile(path = '.env'): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out.set(key, value);
  }
  return out;
}

const fingerprint = (v: string) => crypto.createHash('sha256').update(v).digest('hex').slice(0, 8);

async function vercel(path: string, init: RequestInit = {}): Promise<Response> {
  const joiner = path.includes('?') ? '&' : '?';
  return fetch(`https://api.vercel.com${path}${joiner}teamId=${TEAM}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

async function main() {
  const env = readEnvFile();

  // The service-account file is flattened into a single variable, because a
  // file path means nothing on Vercel.
  const credsPath = env.get('GOOGLE_APPLICATION_CREDENTIALS');
  if (credsPath && !env.get('FIREBASE_SERVICE_ACCOUNT')) {
    const json = JSON.parse(readFileSync(credsPath.replace(/^\.\//, ''), 'utf8'));
    env.set('FIREBASE_SERVICE_ACCOUNT', JSON.stringify(json));
    console.log(`  Flattened ${credsPath} into FIREBASE_SERVICE_ACCOUNT.`);
  }

  const existing = (await (await vercel(`/v10/projects/${PROJECT}/env`)).json()) as {
    envs: Array<{ id: string; key: string }>;
  };
  const byKey = new Map(existing.envs.map((e) => [e.key, e]));

  const push: Array<[string, string]> = [];
  for (const [key, value] of env) {
    if (REMOVE.has(key) || !value) continue;
    push.push([key, value]);
  }

  console.log(`\n─── ${apply ? 'APPLYING' : 'Dry run'} ──────────────────────────────────`);
  console.log('\n  Will set:');
  for (const [key, value] of push) {
    console.log(`    ${key.padEnd(28)} ${String(value.length).padStart(5)} chars  #${fingerprint(value)}`);
  }

  const removing = [...byKey.keys()].filter((k) => REMOVE.has(k));
  if (removing.length) {
    console.log('\n  Will REMOVE (local-only, or unsafe in production):');
    for (const key of removing) console.log(`    ${key}`);
  }

  if (!apply) {
    console.log('\n  Nothing written. Re-run with --apply.\n');
    return;
  }

  for (const key of removing) {
    const res = await vercel(`/v9/projects/${PROJECT}/env/${byKey.get(key)!.id}`, {
      method: 'DELETE',
    });
    console.log(`  removed ${key}: ${res.ok ? 'ok' : await res.text()}`);
  }

  for (const [key, value] of push) {
    // Replace rather than patch: an existing entry may target only some
    // environments, and a partial overlap is how a variable ends up set in
    // preview but missing in production.
    const found = byKey.get(key);
    if (found) {
      await vercel(`/v9/projects/${PROJECT}/env/${found.id}`, { method: 'DELETE' });
    }

    const res = await vercel(`/v10/projects/${PROJECT}/env`, {
      method: 'POST',
      body: JSON.stringify({ key, value, type: 'encrypted', target: TARGETS }),
    });
    console.log(`  set ${key.padEnd(28)} ${res.ok ? 'ok' : `FAILED ${await res.text()}`}`);
  }

  console.log('\n  Done. Redeploy for these to take effect.\n');
}

main().catch((err) => {
  console.error('FAILED:', err?.message ?? err);
  process.exit(1);
});
