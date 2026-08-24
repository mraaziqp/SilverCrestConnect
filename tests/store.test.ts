/**
 * Storage-mode detection.
 *
 * On a serverless platform the filesystem is writable, so a naive "can I
 * write?" check reports healthy right up until the records vanish between
 * requests. These pin down that serverless is reported as non-persistent.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

import { Store, detectEphemeralFilesystem, makeReference } from '../src/server/store.ts';

test('serverless environments are detected as ephemeral', () => {
  assert.equal(detectEphemeralFilesystem({ VERCEL: '1' } as NodeJS.ProcessEnv), true);
  assert.equal(
    detectEphemeralFilesystem({ AWS_LAMBDA_FUNCTION_NAME: 'fn' } as NodeJS.ProcessEnv),
    true,
  );
  assert.equal(detectEphemeralFilesystem({} as NodeJS.ProcessEnv), false);
});

test('an ephemeral store reports NOT persistent even though writes succeed', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scc-eph-'));
  const store = new Store(dir, true);
  await store.init();

  // The write genuinely works...
  await store.addPayment({
    id: 'pay_1',
    reference: 'DON-1',
    kind: 'DONATION',
    amountZAR: 100,
    status: 'PENDING',
    name: 'Test',
    email: 't@example.co.za',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  assert.equal(store.getPayment('DON-1')?.reference, 'DON-1');

  // ...but it must not be advertised as durable.
  assert.equal(store.isPersistent, false, 'serverless must never report persistent');
  assert.match(store.storageNote, /WILL be lost/);

  await fs.rm(dir, { recursive: true, force: true });
});

test('a normal directory reports persistent and survives a reload', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scc-disk-'));

  const first = new Store(dir, false);
  await first.init();
  assert.equal(first.isPersistent, true);
  assert.equal(first.storageNote, 'Records are written to disk.');

  await first.addApplication({
    id: 'app_1',
    reference: 'SCC26-KEEP01',
    businessName: 'Persisted Co',
    contactName: 'Tester',
    email: 'keep@example.co.za',
    phone: '+27 21 555 0100',
    industry: 'Testing',
    about: 'A record that must survive a restart.',
    status: 'PENDING_REVIEW',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // A fresh Store over the same directory stands in for a restart.
  const second = new Store(dir, false);
  await second.init();
  assert.equal(second.getApplication('SCC26-KEEP01')?.businessName, 'Persisted Co');

  await fs.rm(dir, { recursive: true, force: true });
});

test('references are unique and use an unambiguous alphabet', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 500; i += 1) seen.add(makeReference('SCC26'));
  assert.equal(seen.size, 500, 'references must not collide');
  // No O/0/I/1 — these get misread when someone reads a code down the phone.
  for (const ref of seen) assert.doesNotMatch(ref, /[O01I]/);
});
