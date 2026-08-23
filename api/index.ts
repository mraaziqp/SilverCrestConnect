/**
 * Vercel serverless entrypoint.
 *
 * The original vercel.json deployed the client as a static site only, so every
 * /api/* call 404'd in production while working locally. This handler mounts
 * the same Express app behind Vercel's Node runtime so the deployed site has a
 * working API and a reachable PayFast ITN endpoint.
 *
 * Note: serverless filesystems are ephemeral, so the JSON store degrades to
 * memory here and records do not survive between invocations. Set DATA_DIR to
 * a mounted volume, or move the Store to a database, before taking live
 * payments on this target. See README, "Deploying".
 */

import type { IncomingMessage, ServerResponse } from 'http';
import type { Express } from 'express';

import { createApp } from '../src/server/app.js';
import { loadPayFastConfig } from '../src/server/payfast.js';
import { Store } from '../src/server/store.js';
import { createMailer, loadMailerConfig } from '../src/server/email/mailer.js';

let cached: Promise<Express> | undefined;

function bootstrap(): Promise<Express> {
  if (!cached) {
    cached = (async () => {
      const store = new Store(process.env.DATA_DIR || '/tmp/silvercrest');
      await store.init();

      // Static assets are served by Vercel's CDN, so no distPath here.
      return createApp({
        store,
        payfast: loadPayFastConfig(),
        mailer: createMailer(loadMailerConfig()),
      });
    })();
  }
  return cached;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const app = await bootstrap();
  app(req as never, res as never);
}
