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

import { JsonStore, detectEphemeralFilesystem, makeReference } from '../src/server/store.ts';

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
  const store = new JsonStore(dir, true);
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
  assert.equal((await store.getPayment('DON-1'))?.reference, 'DON-1');

  // ...but it must not be advertised as durable.
  assert.equal(store.isPersistent, false, 'serverless must never report persistent');
  assert.match(store.storageNote, /WILL be lost/);

  await fs.rm(dir, { recursive: true, force: true });
});

test('a normal directory reports persistent and survives a reload', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scc-disk-'));

  const first = new JsonStore(dir, false);
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
  const second = new JsonStore(dir, false);
  await second.init();
  assert.equal((await second.getApplication('SCC26-KEEP01'))?.businessName, 'Persisted Co');

  await fs.rm(dir, { recursive: true, force: true });
});

test('references are unique and use an unambiguous alphabet', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 500; i += 1) seen.add(makeReference('SCC26'));
  assert.equal(seen.size, 500, 'references must not collide');
  // No O/0/I/1 — these get misread when someone reads a code down the phone.
  for (const ref of seen) assert.doesNotMatch(ref, /[O01I]/);
});

/**
 * Seats are people, not businesses.
 *
 * An application may bring a second representative, so counting PAID rows
 * sizes the room in companies and lets a 50-seat venue admit up to 100 people.
 * Rows written before the second-representative option carry no attendeeCount
 * and must still count as one.
 */
test('paid seats count attendees, not applications', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scc-seats-'));
  const store = new JsonStore(dir, false);
  await store.init();

  const base = {
    businessName: 'Seat Co',
    contactName: 'Tester',
    email: 'seats@example.co.za',
    phone: '+27 21 555 0100',
    industry: 'Testing',
    about: 'An application used to size the room.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Two representatives — two seats.
  await store.addApplication({ ...base, id: 'app_two', reference: 'SCC26-TWO', status: 'PAID', attendeeCount: 2 });
  assert.equal(await store.countPaidSeats(), 2, 'a two-representative booking takes two seats');

  // One representative — one more seat.
  await store.addApplication({ ...base, id: 'app_one', reference: 'SCC26-ONE', status: 'PAID', attendeeCount: 1 });
  assert.equal(await store.countPaidSeats(), 3);

  // A legacy row with no attendeeCount counts as one, never as zero.
  await store.addApplication({ ...base, id: 'app_old', reference: 'SCC26-OLD', status: 'PAID' });
  assert.equal(await store.countPaidSeats(), 4, 'a legacy row must count as one seat');

  // Unpaid applications hold no seat at all.
  await store.addApplication({
    ...base,
    id: 'app_pending',
    reference: 'SCC26-PEND',
    status: 'PENDING_REVIEW',
    attendeeCount: 2,
  });
  assert.equal(await store.countPaidSeats(), 4, 'only PAID applications occupy seats');

  await fs.rm(dir, { recursive: true, force: true });
});

test('deleteApplication removes application and returns boolean', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scc-del-'));
  const store = new JsonStore(dir, false);
  await store.init();

  await store.addApplication({
    id: 'app_delete_me',
    reference: 'SCC26-DEL1',
    businessName: 'Delete Me Co',
    contactName: 'Tester',
    email: 'del@example.co.za',
    phone: '+27 21 555 0100',
    industry: 'Testing',
    about: 'To be deleted.',
    status: 'PENDING_REVIEW',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  assert.equal((await store.getApplication('SCC26-DEL1'))?.businessName, 'Delete Me Co');

  // Deleting existing returns true and removes the record
  const deleted = await store.deleteApplication('app_delete_me');
  assert.equal(deleted, true);
  assert.equal(await store.getApplication('SCC26-DEL1'), undefined);

  // Deleting non-existent returns false
  const deleteAgain = await store.deleteApplication('app_delete_me');
  assert.equal(deleteAgain, false);

  await fs.rm(dir, { recursive: true, force: true });
});

test('getGallery returns default gallery when empty and persists updates', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scc-gal-'));
  const store = new JsonStore(dir, false);
  await store.init();

  const gallery = await store.getGallery();
  assert.equal(Array.isArray(gallery), true);
  assert.ok(gallery.length > 0, 'must not be empty');

  // Update gallery
  const updated = await store.updateGallery([
    { id: 'img_1', url: 'https://example.com/photo.jpg', caption: 'Custom caption' },
  ]);
  assert.equal(updated.length, 1);
  assert.equal((await store.getGallery())[0].caption, 'Custom caption');

  await fs.rm(dir, { recursive: true, force: true });
});
