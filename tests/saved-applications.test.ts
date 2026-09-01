/**
 * Remembering an applicant's reference on their device.
 *
 * This is the only self-service route back to an application — there is no
 * lookup by email, deliberately — so the failure modes matter more than the
 * happy path. In particular it must survive localStorage being unavailable,
 * which is the normal state in some privacy modes, without taking the page
 * down with it.
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  rememberApplication,
  listSavedApplications,
  forgetApplication,
  applicationUrl,
} from '../src/lib/savedApplications.ts';

/** Minimal localStorage, so these run under Node without a DOM. */
function installStorage(impl?: Partial<Storage>) {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    length: 0,
    ...impl,
  } as Storage;

  (globalThis as unknown as { window: unknown }).window = {
    localStorage: storage,
    location: { origin: 'https://scconnect.co.za' },
  };
  return data;
}

beforeEach(() => {
  installStorage();
});

test('a submitted reference can be read back', () => {
  rememberApplication('SCC26-ABC123', 'Woodstock Sourdough');
  const saved = listSavedApplications();

  assert.equal(saved.length, 1);
  assert.equal(saved[0].reference, 'SCC26-ABC123');
  assert.equal(saved[0].businessName, 'Woodstock Sourdough');
});

test('references are normalised to upper case', () => {
  rememberApplication('  scc26-abc123  ');
  assert.equal(listSavedApplications()[0].reference, 'SCC26-ABC123');
});

test('remembering the same reference twice does not duplicate it', () => {
  rememberApplication('SCC26-ABC123', 'Woodstock Sourdough');
  rememberApplication('scc26-abc123');

  const saved = listSavedApplications();
  assert.equal(saved.length, 1);
  // The name from the first call survives a later one that has none.
  assert.equal(saved[0].businessName, 'Woodstock Sourdough');
});

test('several applications are kept, most recent first', () => {
  rememberApplication('SCC26-OLD001', 'First Business');
  rememberApplication('SCC26-NEW002', 'Second Business');

  const saved = listSavedApplications();
  assert.equal(saved.length, 2);
  assert.equal(saved[0].reference, 'SCC26-NEW002');
});

test('an empty reference is ignored', () => {
  rememberApplication('');
  rememberApplication('   ');
  assert.equal(listSavedApplications().length, 0);
});

test('forgetting removes only that reference', () => {
  rememberApplication('SCC26-KEEP01');
  rememberApplication('SCC26-DROP02');
  forgetApplication('scc26-drop02');

  const saved = listSavedApplications();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].reference, 'SCC26-KEEP01');
});

test('corrupt stored data is discarded rather than thrown', () => {
  const data = installStorage();
  data.set('scc26.applications', 'not json at all');
  assert.doesNotThrow(() => listSavedApplications());
  assert.deepEqual(listSavedApplications(), []);

  data.set('scc26.applications', '{"not":"an array"}');
  assert.deepEqual(listSavedApplications(), []);

  // An array whose entries are the wrong shape.
  data.set('scc26.applications', '[{"nope":1},null,"x"]');
  assert.deepEqual(listSavedApplications(), []);
});

test('storage that throws does not break the page', () => {
  // Private browsing modes throw on both read and write.
  installStorage({
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  });

  assert.doesNotThrow(() => rememberApplication('SCC26-ABC123'));
  assert.doesNotThrow(() => listSavedApplications());
  assert.deepEqual(listSavedApplications(), []);
});

test('applicationUrl builds the page an applicant returns to', () => {
  assert.equal(
    applicationUrl('scc26-abc123'),
    'https://scconnect.co.za/pay/SCC26-ABC123',
  );
});
