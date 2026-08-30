/**
 * Checks a deployed site from the outside.
 *
 * Written after a test booking returned 404. The site itself was serving
 * perfectly — the static build was current and every asset loaded — but the
 * API behind it did not exist, so every form 404'd. From a browser those two
 * situations look identical: the page loads, then nothing works.
 *
 * This tells them apart. Point it at any origin and it reports which pieces
 * are actually wired, and what to do about the ones that are not.
 *
 * Usage:
 *   npx tsx scripts/check-deployment.ts https://main.xxxx.amplifyapp.com
 *   npx tsx scripts/check-deployment.ts https://scconnect.co.za
 *
 * Read-only. It never submits an application or starts a payment.
 */

const base = (process.argv[2] || '').replace(/\/+$/, '');

if (!base) {
  console.error('\nUsage: npx tsx scripts/check-deployment.ts <url>\n');
  process.exit(1);
}

type Result = { ok: boolean; label: string; detail: string; fix?: string };

const results: Result[] = [];
const TIMEOUT = 15_000;

async function get(path: string): Promise<{ status: number; type: string; body: string }> {
  const res = await fetch(base + path, {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT),
  });
  return {
    status: res.status,
    type: res.headers.get('content-type') ?? '',
    body: (await res.text()).slice(0, 4000),
  };
}

async function check(label: string, fn: () => Promise<Result>): Promise<void> {
  try {
    results.push(await fn());
  } catch (err) {
    results.push({ ok: false, label, detail: `request failed — ${(err as Error).message}` });
  }
}

await check('Static site', async () => {
  const r = await get('/');
  if (r.status !== 200) {
    return {
      ok: false,
      label: 'Static site',
      detail: `HTTP ${r.status}`,
      fix: 'The host is not serving the build. Check the deployment succeeded.',
    };
  }
  const isApp = r.body.includes('Silver Crest');
  return {
    ok: isApp,
    label: 'Static site',
    detail: isApp ? 'serving the built client' : 'HTTP 200 but this is not the app',
    fix: isApp ? undefined : 'Something else is answering on this domain.',
  };
});

await check('API reachable', async () => {
  const r = await get('/api/health');

  if (r.status === 404) {
    return {
      ok: false,
      label: 'API reachable',
      detail: 'HTTP 404 — nothing is answering /api/*',
      fix:
        'This is what makes a booking fail. A static host serves files only. Deploy the API ' +
        '(App Runner: apprunner.yaml) and add a 200-rewrite from /api/<*> to it, placed ABOVE ' +
        'the SPA catch-all rule.',
    };
  }

  if (!r.type.includes('application/json')) {
    return {
      ok: false,
      label: 'API reachable',
      detail: `HTTP ${r.status} but returned ${r.type || 'no content-type'}, not JSON`,
      fix:
        'The SPA catch-all is swallowing /api/*. Move the /api/<*> rewrite ABOVE it, or the ' +
        'forms receive the HTML page where they expect JSON.',
    };
  }

  return { ok: true, label: 'API reachable', detail: `HTTP ${r.status}, JSON` };
});

await check('Records persist', async () => {
  const r = await get('/api/health');
  if (!r.type.includes('application/json')) {
    return { ok: false, label: 'Records persist', detail: 'skipped — no API' };
  }
  const health = JSON.parse(r.body) as { persistent?: boolean; storage?: string };
  return {
    ok: health.persistent === true,
    label: 'Records persist',
    detail: health.storage ?? String(health.persistent),
    fix:
      health.persistent === true
        ? undefined
        : 'Applications and payments will be LOST. Set STORE_DRIVER and the FIREBASE_* variables ' +
          'on the API host — FIREBASE_SERVICE_ACCOUNT must be the whole JSON on one line.',
  };
});

await check('Payments', async () => {
  const r = await get('/api/health');
  if (!r.type.includes('application/json')) {
    return { ok: false, label: 'Payments', detail: 'skipped — no API' };
  }
  const health = JSON.parse(r.body) as { paymentsOpen?: boolean; payfastMode?: string };
  // Closed is a deliberate, valid state, so this reports rather than fails.
  return {
    ok: true,
    label: 'Payments',
    detail:
      health.paymentsOpen === false
        ? 'CLOSED — applications accepted, no money can be taken (PAYMENTS_OPEN)'
        : `open, mode: ${health.payfastMode ?? 'unknown'}`,
  };
});

for (const path of ['/admin', '/pay/SCC26-EXAMPLE']) {
  await check(`Deep link ${path}`, async () => {
    const r = await get(path);
    if (r.status === 404) {
      return {
        ok: false,
        label: `Deep link ${path}`,
        detail: 'HTTP 404',
        fix:
          'The SPA catch-all rewrite is missing, so any link opened directly fails — including ' +
          'the payment links in approval emails. Add a 200-rewrite from the SPA pattern to ' +
          '/index.html.',
      };
    }
    return { ok: r.status === 200, label: `Deep link ${path}`, detail: `HTTP ${r.status}` };
  });
}

console.log(`\n─── ${base} ${'─'.repeat(Math.max(0, 56 - base.length))}`);

for (const r of results) {
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'}  ${r.label.padEnd(24)} ${r.detail}`);
}

const failures = results.filter((r) => !r.ok && r.fix);
if (failures.length) {
  console.log('\n  To fix:');
  for (const f of failures) console.log(`\n  ${f.label}\n    ${f.fix}`);
}

const broken = results.filter((r) => !r.ok).length;
console.log(
  broken === 0
    ? '\n  Everything is wired. A booking will work end to end.\n'
    : `\n  ${broken} problem(s). A booking will not complete until these are fixed.\n`,
);

process.exitCode = broken === 0 ? 0 : 1;
