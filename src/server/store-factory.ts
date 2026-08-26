/**
 * Chooses a storage driver.
 *
 * Firestore when it is configured, otherwise the local JSON file. The JSON
 * driver is right for a Node host with a disk and for local development; it is
 * NOT right for serverless, where it reports itself as non-persistent.
 */

import path from 'path';

import type { DataStore } from './store-types.js';
import { JsonStore } from './store.js';
import { FirestoreStore, loadFirestoreConfig, type FirestoreConfig } from './store-firestore.js';

export function shouldUseFirestore(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.STORE_DRIVER === 'json') return false;
  const config = loadFirestoreConfig(env);
  return Boolean(config.credentialsJson || config.credentialsPath);
}

export async function createStore(
  env: NodeJS.ProcessEnv = process.env,
  fallbackDir = path.join(process.cwd(), 'data'),
): Promise<DataStore> {
  if (shouldUseFirestore(env)) {
    const config: FirestoreConfig = loadFirestoreConfig(env);
    const store = new FirestoreStore(config);
    await store.init();
    return store;
  }

  const store = new JsonStore(env.DATA_DIR || fallbackDir);
  await store.init();
  return store;
}
