/**
 * Standalone Node entrypoint.
 *
 * In development it attaches Vite as middleware so the client hot-reloads;
 * in production it serves the built assets out of dist/.
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

import { createApp } from './src/server/app.js';
import { loadPayFastConfig } from './src/server/payfast.js';
import { Store } from './src/server/store.js';
import { createMailer, loadMailerConfig } from './src/server/email/mailer.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * In development this file runs from the project root via tsx; in production
 * the bundle lives at dist/server.mjs. Resolve the root from whichever it is,
 * so the client assets and the data directory are found in both cases.
 */
const projectRoot = path.basename(here) === 'dist' ? path.resolve(here, '..') : here;
const clientDist = path.join(projectRoot, 'dist');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

async function main(): Promise<void> {
  const store = new Store(process.env.DATA_DIR || path.join(projectRoot, 'data'));
  await store.init();

  const payfast = loadPayFastConfig();
  const mailerConfig = loadMailerConfig();
  const mailer = createMailer(mailerConfig);

  const app = await createApp({
    store,
    payfast,
    mailer,
    mailerConfig,
    distPath: isProduction ? clientDist : undefined,
    attachVite: isProduction
      ? undefined
      : async (expressApp) => {
          const { createServer } = await import('vite');
          const vite = await createServer({
            server: { middlewareMode: true },
            appType: 'spa',
            root: projectRoot,
          });
          expressApp.use(vite.middlewares);
        },
  });

  app.listen(PORT, HOST, () => {
    console.log(
      `[Silver Crest Connect] ${isProduction ? 'production' : 'development'} server on http://${HOST}:${PORT}`,
    );
    console.log(
      `[Silver Crest Connect] PayFast: ${payfast.mode} mode, credentials ${
        payfast.isConfigured ? 'loaded' : 'NOT set (using sandbox defaults)'
      }`,
    );
    console.log(
      `[Silver Crest Connect] Email: ${
        mailer.configured
          ? `${mailer.driver}${mailerConfig.smtp ? ` (${mailerConfig.smtp.host}:${mailerConfig.smtp.port})` : ''}, from ${mailer.from}`
          : 'console driver — messages are logged, NOT delivered'
      }`,
    );

    // Prove the credentials work now rather than on the first real applicant.
    void mailer.verify?.().then((result) => {
      if (result.ok) {
        console.log('[Silver Crest Connect] SMTP connection verified.');
      } else {
        console.error(`[Silver Crest Connect] SMTP verification FAILED: ${result.error}`);
      }
    });
    if (!store.isPersistent) {
      console.warn('[Silver Crest Connect] Datastore is memory-only — records will not survive a restart.');
    }
    if (!process.env.ADMIN_TOKEN) {
      console.warn('[Silver Crest Connect] ADMIN_TOKEN is not set — the admin dashboard is disabled.');
    }
  });
}

main().catch((err) => {
  console.error('[Silver Crest Connect] Failed to start:', err);
  process.exit(1);
});
