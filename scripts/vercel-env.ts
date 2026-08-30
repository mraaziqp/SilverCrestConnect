/**
 * Pushes environment variables to a Vercel project.
 *
 * Vercel does not read .env from the repo — it has its own store, per
 * environment. Setting twenty-odd variables by hand in the dashboard is where
 * a deployment quietly goes wrong: one typo in FIREBASE_SERVICE_ACCOUNT and
 * the store silently degrades to memory, so applications and paid tickets are
 * accepted and then lost.
 *
 * Reads the local .env, then pushes each key to production, preview and
 * development. Existing values are replaced.
 *
 * Usage:
 *   npx tsx scripts/vercel-env.ts                      dry run, shows what would be set
 *   npx tsx scripts/vercel-env.ts --apply              push them
 *   npx tsx scripts/vercel-env.ts --apply --scope <team>
 *
 * Requires the Vercel CLI to be logged in and the project linked
 * (`vercel login` then `vercel link`).
 *
 * Secret values are never printed — only key names, lengths and a fingerprint.
 */

import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';

const apply = process.argv.includes('--apply');
const scopeIdx = process.argv.indexOf('--scope');
const scope = scopeIdx > -1 ? process.argv[scopeIdx + 1] : undefined;

const ENVIRONMENTS = ['production', 'preview', 'development'] as const;

/**
 * Values published to a public GitHub repository in commit 21e7bfa and never
 * rotated. Pushing one of these would put a credential that anyone can read
 * into production. Refused rather than warned: the whole point of this script
 * is to run unattended, and a warning scrolls past.
 *
 * Stored as SHA-256 so this file does not itself become a copy of the leak.
 * Remove an entry once that credential has genuinely been rotated.
 */
const LEAKED_DIGESTS = new Set<string>([
  '1cc2132e6179bcd7c11cdeddad33da18d6e8ff4d24bbb60eab76f60a669e7798', // ADMIN_TOKEN as committed in 21e7bfa
  'd7aa6e723a7dbc0f583e49a521bdbfdf7c937f759b12e3b699c2ab45eda40260', // PAYFAST_PASSPHRASE as committed in 21e7bfa
  '17b1c65413aa31c5e24a1d553c6c55385e1bce54603632eec768a5c49cc332fa', // SMTP_PASS as committed in 21e7bfa
]);

/** Never sent to Vercel: local-only, or meaningless there. */
const SKIP = new Set([
  'PORT',
  'HOST',
  'DATA_DIR',
  'GOOGLE_APPLICATION_CREDENTIALS', // a file path; FIREBASE_SERVICE_ACCOUNT replaces it
  'PAYFAST_SKIP_IP_CHECK',
  'PAYFAST_SKIP_SERVER_CONFIRM',
  'EMAIL_REDIRECT_TO',
]);

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function fingerprint(value: string): string {
  return digest(value).slice(0, 8);
}

/** Minimal .env parser: KEY=value, optional quotes, # comments, blank lines. */
function parseEnv(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    out.set(key, value);
  }
  return out;
}

function vercel(args: string[], input?: string): string {
  const full = scope ? [...args, '--scope', scope] : args;
  return execFileSync('vercel', full, {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

// ---------------------------------------------------------------------------

if (!existsSync('.env')) {
  console.error('\n  No .env found. Copy .env.example to .env and fill it in first.\n');
  process.exit(1);
}

const env = parseEnv(readFileSync('.env', 'utf8'));

// FIREBASE_SERVICE_ACCOUNT is usually a file path locally and must become the
// JSON itself on Vercel, which has no filesystem to point at.
const keyPath = env.get('GOOGLE_APPLICATION_CREDENTIALS');
if (!env.get('FIREBASE_SERVICE_ACCOUNT') && keyPath && existsSync(keyPath)) {
  env.set('FIREBASE_SERVICE_ACCOUNT', JSON.stringify(JSON.parse(readFileSync(keyPath, 'utf8'))));
  console.log(`\n  Flattened ${keyPath} into FIREBASE_SERVICE_ACCOUNT.`);
}

console.log('\n─── Environment variables ────────────────────────────────────');
console.log(`  Mode    ${apply ? 'APPLY — values will be written to Vercel' : 'dry run'}`);
if (scope) console.log(`  Scope   ${scope}`);

const planned: Array<[string, string]> = [];
const refused: string[] = [];
const skipped: string[] = [];

for (const [key, value] of env) {
  if (SKIP.has(key)) { skipped.push(key); continue; }
  if (!value) { skipped.push(`${key} (empty)`); continue; }
  if (LEAKED_DIGESTS.has(digest(value))) { refused.push(key); continue; }
  planned.push([key, value]);
}

console.log('\n  Will set:');
for (const [key, value] of planned) {
  console.log(`    ${key.padEnd(30)} ${String(value.length).padStart(5)} chars  #${fingerprint(value)}`);
}

if (skipped.length) console.log(`\n  Skipped: ${skipped.join(', ')}`);

if (refused.length) {
  console.log('\n  REFUSED — these values are in the public git history (commit 21e7bfa):');
  for (const key of refused) console.log(`    ${key}`);
  console.log('\n  Rotate them at source, put the new values in .env, then re-run.');
}

// ---------------------------------------------------------------------------
// Sanity checks on the resulting configuration.
//
// Each of these has a failure mode that looks fine at deploy time and only
// surfaces once a real applicant is involved, which is far too late.

const problems: string[] = [];
const value = (k: string) => planned.find(([key]) => key === k)?.[1] ?? '';

const appUrl = value('APP_URL');
if (!appUrl) {
  problems.push('APP_URL is not set. PayFast return links and applicant emails are built from it.');
} else if (/localhost|127\.0\.0\.1/.test(appUrl)) {
  problems.push(
    `APP_URL is still ${appUrl}. On Vercel that sends every applicant a payment link, and ` +
      'every link inside every email, pointing at their own machine. Set it to the live URL.',
  );
} else if (!appUrl.startsWith('https://')) {
  problems.push('APP_URL is not HTTPS. PayFast will not deliver ITN callbacks to it in live mode.');
}

if (!(value('FIREBASE_SERVICE_ACCOUNT') && value('FIREBASE_PROJECT_ID'))) {
  problems.push(
    'No Firebase credentials. Vercel has no persistent disk, so the store falls back to memory ' +
      'and every application and paid ticket is lost between requests.',
  );
}

const hasMail =
  Boolean(value('SMTP_HOST') && value('SMTP_USER') && value('SMTP_PASS')) ||
  Boolean(value('RESEND_API_KEY'));
if (!hasMail) {
  problems.push(
    'No mail driver. The approval email is what carries the payment link, so without this an ' +
      'approved applicant is never told they can pay.',
  );
}

// The dangerous combination: real merchant credentials present, so payments
// default to open, while the gateway is still the sandbox.
const credentialsPresent = Boolean(value('PAYFAST_MERCHANT_ID') && value('PAYFAST_MERCHANT_KEY'));
const sandbox = value('PAYFAST_MODE') !== 'live';
if (credentialsPresent && sandbox && env.get('PAYMENTS_OPEN') !== 'false') {
  problems.push(
    'Payments would be OPEN against the PayFast SANDBOX. Real applicants would be sent to a test ' +
      'gateway and told their seat was secured once it cleared. Set PAYMENTS_OPEN=false until you ' +
      'go live, or PAYFAST_MODE=live with live credentials.',
  );
}

if (value('PAYFAST_MODE') === 'live' && !value('PAYFAST_PASSPHRASE')) {
  problems.push('Live mode without PAYFAST_PASSPHRASE. ITN signatures will not verify.');
}

if (problems.length) {
  console.log('\n  CHECK THESE BEFORE DEPLOYING:');
  for (const p of problems) console.log(`    - ${p}`);
}

if (!apply) {
  console.log('\n  Nothing written. Re-run with --apply.\n');
  process.exit(refused.length ? 1 : 0);
}

let written = 0;
for (const [key, value] of planned) {
  for (const target of ENVIRONMENTS) {
    try {
      vercel(['env', 'rm', key, target, '--yes']);
    } catch {
      // Not set yet, which is the normal case on a first run.
    }
    vercel(['env', 'add', key, target], value);
  }
  written += 1;
  console.log(`    set ${key}`);
}

console.log(`\n  ${written} variable(s) set across ${ENVIRONMENTS.join(', ')}.`);
console.log('  Redeploy for them to take effect, then check /api/health reports persistent: true.\n');

process.exitCode = refused.length ? 1 : 0;
