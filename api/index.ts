/**
 * Vercel serverless entrypoint.
 *
 * The original vercel.json deployed the client as a static site only, so every
 * /api/* call 404'd in production while working locally. This handler mounts
 * the same Express app behind Vercel's Node runtime so the deployed site has a
 * working API and a reachable PayFast ITN endpoint.
 *
 * Storage matters more here than anywhere else. Serverless filesystems are
 * ephemeral, so the JSON store degrades to memory and a record written by one
 * invocation is gone by the next — writes succeed, the applicant sees a
 * success page, and a paid ticket disappears. Set STORE_DRIVER=rtdb with the
 * FIREBASE_* variables so records go to Firebase instead. /api/health reports
 * `persistent`; if it is false, nothing that arrives will be kept.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import type { Express } from 'express';

import { createApp } from '../src/server/app.js';
import { loadPayFastConfig } from '../src/server/payfast.js';
import { createStore } from '../src/server/store-factory.js';
import { createMailer, loadMailerConfig } from '../src/server/email/mailer.js';

let cached: Promise<Express> | undefined;

function bootstrap(): Promise<Express> {
  if (!cached) {
    cached = (async () => {
      const store = await createStore(process.env, '/tmp/silvercrest');

      if (!store.isPersistent) {
        // Loud, because the failure is silent otherwise: writes succeed, the
        // applicant sees a success page, and the record is gone by the next
        // request. A paid ticket can be lost this way.
        console.error(`[storage] ${store.storageNote}`);
      }

      // Static assets are served by Vercel's CDN, so no distPath here.
      const mailerConfig = loadMailerConfig();
      return createApp({
        store,
        payfast: loadPayFastConfig(),
        mailer: createMailer(mailerConfig),
        mailerConfig,
      });
    })();
  }
  return cached;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const app = await bootstrap();
  app(req as never, res as never);
}
