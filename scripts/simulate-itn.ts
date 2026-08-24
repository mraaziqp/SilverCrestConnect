/**
 * Simulates a PayFast ITN callback against a locally running server.
 *
 * PayFast cannot reach localhost, so this stands in for it during development:
 * it builds a correctly signed notification and posts it to /api/payfast/itn.
 *
 * Usage:
 *   npx tsx scripts/simulate-itn.ts <m_payment_id> <amount> [payment_status] [--tamper]
 *
 * Examples:
 *   npx tsx scripts/simulate-itn.ts TKT-8R5J33 350.00
 *   npx tsx scripts/simulate-itn.ts TKT-8R5J33 350.00 COMPLETE --tamper
 *
 * Requires PAYFAST_SKIP_IP_CHECK and PAYFAST_SKIP_SERVER_CONFIRM to be "true"
 * in .env, since a local simulator is neither a PayFast IP nor confirmable.
 */

import 'dotenv/config';
import { signPayload } from '../src/server/payfast.ts';

const [reference, amount, statusArg] = process.argv.slice(2);
const tamper = process.argv.includes('--tamper');
const paymentStatus = statusArg && !statusArg.startsWith('--') ? statusArg : 'COMPLETE';

if (!reference || !amount) {
  console.error('Usage: tsx scripts/simulate-itn.ts <m_payment_id> <amount> [status] [--tamper]');
  process.exit(1);
}

const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
const passphrase = (process.env.PAYFAST_PASSPHRASE || '').trim();

// PayFast sends the merchant's own id back on the notification.
const merchantId =
  process.env.PAYFAST_MODE === 'live' ? process.env.PAYFAST_MERCHANT_ID || '10000100' : '10000100';

// Field order here is the order PayFast posts them in.
const payload: Record<string, string> = {
  m_payment_id: reference,
  pf_payment_id: String(1_600_000 + Math.floor(Math.random() * 100_000)),
  payment_status: paymentStatus,
  item_name: 'Silver Crest Connect - simulated',
  amount_gross: Number(amount).toFixed(2),
  amount_fee: (-Math.round(Number(amount) * 0.029 * 100) / 100).toFixed(2),
  amount_net: (Number(amount) - Math.round(Number(amount) * 0.029 * 100) / 100).toFixed(2),
  name_first: 'Wesley',
  name_last: 'Bosman',
  email_address: 'wesley@example.co.za',
  merchant_id: merchantId,
};

const order = Object.keys(payload);
const signature = signPayload(payload, order, passphrase);

const body = new URLSearchParams({
  ...payload,
  // A tampered signature must be rejected outright.
  signature: tamper ? '0'.repeat(32) : signature,
}).toString();

const res = await fetch(`${appUrl}/api/payfast/itn`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body,
});

console.log(`POST /api/payfast/itn -> ${res.status} ${await res.text()}`);
console.log(`  reference : ${reference}`);
console.log(`  amount    : R${Number(amount).toFixed(2)}`);
console.log(`  status    : ${paymentStatus}`);
console.log(`  signature : ${tamper ? 'DELIBERATELY INVALID' : signature}`);
console.log('\nCheck the server log for the [itn] line, then re-read the payment status.');
