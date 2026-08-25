/**
 * Mail configuration diagnostic.
 *
 * Answers "will email actually work?" without deploying anything. Reads .env,
 * reports the resolved settings, opens a real connection, and optionally sends
 * a real message.
 *
 * Usage:
 *   npx tsx scripts/test-email.ts                     check config + connection
 *   npx tsx scripts/test-email.ts you@example.co.za   also send a test message
 *
 * The password is never printed.
 */

import 'dotenv/config';

import { createMailer, loadMailerConfig, describeMailer, bareAddress } from '../src/server/email/mailer.ts';
import { applicationApproved } from '../src/server/email/render.ts';

const recipient = process.argv[2];

const config = loadMailerConfig();
const mailer = createMailer(config);

function line(label: string, value: string): void {
  console.log(`  ${label.padEnd(16)} ${value}`);
}

console.log('\n─── Mail configuration ───────────────────────────────────────');
line('Driver', mailer.driver);
line('From', config.from);
line('Reply-To', config.replyTo);

if (config.smtp) {
  line('Host', `${config.smtp.host}:${config.smtp.port}`);
  line('Encryption', config.smtp.secure ? 'implicit TLS' : config.smtp.requireTls ? 'STARTTLS' : 'NONE');
  line('Username', config.smtp.user || '(not set)');
  line('Password', config.smtp.pass ? `set, ${config.smtp.pass.length} characters` : '(not set)');
}
if (config.redirectTo) {
  line('Redirect', `ALL mail -> ${config.redirectTo}`);
}

const described = describeMailer(mailer, config);
if (described.warnings.length > 0) {
  console.log('\n─── Warnings ─────────────────────────────────────────────────');
  for (const warning of described.warnings) console.log(`  ! ${warning}`);
}

if (mailer.driver === 'console') {
  console.log(
    '\nNo mail driver is configured, so nothing will be delivered.\n' +
      'Set SMTP_HOST, SMTP_USER and SMTP_PASS in .env, then run this again.\n',
  );
  process.exit(0);
}

console.log('\n─── Connection ───────────────────────────────────────────────');
const verdict = await mailer.verify?.();

if (verdict && !verdict.ok) {
  console.error(`  FAILED\n\n  ${verdict.error}\n`);
  console.error('─── Likely causes, in order ──────────────────────────────────');
  console.error(`
  1. SMTP AUTH is disabled for the mailbox. It is off by default.
     Microsoft 365 admin -> Users -> Active users -> select the user
     -> Mail -> Manage email apps -> tick "Authenticated SMTP".

  2. The password is the sign-in password, not an app password.
     An account with MFA needs an app password.

  3. Microsoft has been retiring basic authentication for SMTP AUTH.
     If the settings above are all correct and it still fails with 535,
     the tenant may no longer permit username/password SMTP at all. In
     that case the options are OAuth2, or sending through a provider
     such as Resend instead (RESEND_API_KEY is still supported here).
`);
  mailer.close?.();
  process.exit(1);
}

console.log('  OK — connected and authenticated.');

if (!recipient) {
  console.log('\nPass an address to send a real test message:');
  console.log('  npx tsx scripts/test-email.ts you@example.co.za\n');
  mailer.close?.();
  process.exit(0);
}

console.log('\n─── Sending test message ─────────────────────────────────────');
line('To', config.redirectTo || recipient);

// The approval email is the one that matters most — it carries the payment
// link — so it is the most useful one to eyeball.
const result = await mailer.send(
  recipient,
  applicationApproved({
    contactName: 'Test Recipient',
    businessName: 'Test Business (Pty) Ltd',
    reference: 'SCC26-TEST01',
    payUrl: `${(process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '')}/pay/SCC26-TEST01`,
    seatsRemaining: 3,
  }),
);

if (result.ok) {
  console.log(`  SENT${result.id ? ` (${result.id})` : ''}`);
  console.log('\n  Check the inbox — and the junk folder. If it landed in junk,');
  console.log('  the sending domain needs SPF and DKIM records.\n');
} else {
  console.error(`  FAILED\n\n  ${result.error}\n`);
  mailer.close?.();
  process.exit(1);
}

mailer.close?.();
