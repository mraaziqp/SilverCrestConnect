/**
 * Chooses a storage driver.
 *
 * Order of preference:
 *   1. Realtime Database, when FIREBASE_DATABASE_URL is set
 *   2. Firestore, when credentials are present
 *   3. the local JSON file
 *
 * Both Firebase drivers are durable anywhere. The JSON driver is right for a
 * Node host with a disk and for local development, and reports itself as
 * non-persistent on serverless, where its writes are discarded.
 */

import path from 'path';

import type { DataStore } from './store-types.js';
import { JsonStore } from './store.js';
import { FirestoreStore, loadFirestoreConfig } from './store-firestore.js';
import { RtdbStore, loadRtdbConfig } from './store-rtdb.js';

export type StoreKind = 'rtdb' | 'firestore' | 'json';

export function chooseStore(env: NodeJS.ProcessEnv = process.env): StoreKind {
  if (env.STORE_DRIVER === 'json') return 'json';

  const hasCredentials = Boolean(
    (env.FIREBASE_SERVICE_ACCOUNT || '').trim() ||
      (env.GOOGLE_APPLICATION_CREDENTIALS || '').trim(),
  );
  if (!hasCredentials) return 'json';

  if (env.STORE_DRIVER === 'firestore') return 'firestore';
  if (env.STORE_DRIVER === 'rtdb') return 'rtdb';

  // Auto: a database URL means Realtime Database was the one set up.
  return (env.FIREBASE_DATABASE_URL || '').trim() ? 'rtdb' : 'firestore';
}

export async function createStore(
  env: NodeJS.ProcessEnv = process.env,
  fallbackDir = path.join(process.cwd(), 'data'),
): Promise<DataStore> {
  const kind = chooseStore(env);

  if (kind === 'rtdb') {
    const store = new RtdbStore(loadRtdbConfig(env));
    await store.init();
    return store;
  }

  if (kind === 'firestore') {
    const store = new FirestoreStore(loadFirestoreConfig(env));
    await store.init();
    return store;
  }

  const store = new JsonStore(env.DATA_DIR || fallbackDir);
  await store.init();
  return store;
}
