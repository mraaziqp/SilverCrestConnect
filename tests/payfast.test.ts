/**
 * PayFast signature tests.
 *
 * The signature is the one piece of this integration that fails silently and
 * expensively: PayFast just rejects the payment with a generic error, and the
 * cause (an encoding mismatch on one character) is invisible from the outside.
 * These lock the encoding rules down.
 *
 * Run with: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  pfEncode,
  buildSignatureString,
  signPayload,
  buildPaymentFields,
  loadPayFastConfig,
  processUrl,
} from '../src/server/payfast.ts';

const ORDER = ['merchant_id', 'merchant_key', 'amount', 'item_name'] as const;

function md5(value: string): string {
  return crypto.createHash('md5').update(value).digest('hex');
}

test('pfEncode matches PHP urlencode semantics', () => {
  // Spaces become '+', not %20.
  assert.equal(pfEncode('Silver Crest'), 'Silver+Crest');

  // PHP urlencode escapes these; encodeURIComponent alone does not.
  assert.equal(pfEncode('!'), '%21');
  assert.equal(pfEncode("'"), '%27');
  assert.equal(pfEncode('('), '%28');
  assert.equal(pfEncode(')'), '%29');
  assert.equal(pfEncode('*'), '%2A');
  assert.equal(pfEncode('~'), '%7E');

  // PHP urlencode leaves these alone.
  assert.equal(pfEncode('a-b_c.d'), 'a-b_c.d');

  // Hex digits must be uppercase.
  assert.equal(pfEncode('/'), '%2F');
  assert.equal(pfEncode('&'), '%26');

  // A realistic business name with an ampersand and an apostrophe.
  assert.equal(pfEncode("Bosman & Sons' Catering"), 'Bosman+%26+Sons%27+Catering');
});

test('buildSignatureString preserves field order and skips empty values', () => {
  const built = buildSignatureString(
    { merchant_id: '10000100', merchant_key: 'abc', amount: '350.00', item_name: '' },
    ORDER,
    '',
  );
  // item_name is empty and must be omitted entirely.
  assert.equal(built, 'merchant_id=10000100&merchant_key=abc&amount=350.00');
});

test('buildSignatureString respects declared order, not alphabetical order', () => {
  const built = buildSignatureString(
    { amount: '350.00', merchant_id: '10000100', merchant_key: 'abc', item_name: 'Ticket' },
    ORDER,
    '',
  );
  assert.match(built, /^merchant_id=/);
  assert.equal(built, 'merchant_id=10000100&merchant_key=abc&amount=350.00&item_name=Ticket');
});

test('passphrase is appended last and url-encoded', () => {
  const built = buildSignatureString({ merchant_id: '10000100' }, ORDER, 'my secret pass');
  assert.equal(built, 'merchant_id=10000100&passphrase=my+secret+pass');
});

test('signPayload is the md5 of the signature string', () => {
  const data = { merchant_id: '10000100', merchant_key: 'abc', amount: '350.00' };
  const expected = md5('merchant_id=10000100&merchant_key=abc&amount=350.00');
  assert.equal(signPayload(data, ORDER, ''), expected);
});

test('signature changes when the amount changes', () => {
  const a = signPayload({ merchant_id: '1', amount: '350.00' }, ORDER, '');
  const b = signPayload({ merchant_id: '1', amount: '351.00' }, ORDER, '');
  assert.notEqual(a, b);
});

test('buildPaymentFields never returns the merchant key', () => {
  const config = loadPayFastConfig({
    PAYFAST_MODE: 'sandbox',
    APP_URL: 'https://connect.example.co.za',
  } as NodeJS.ProcessEnv);

  const fields = buildPaymentFields(config, {
    reference: 'TKT-ABC123',
    amountZAR: 350,
    itemName: "Silver Crest Connect '26 — SME Ticket",
    nameFirst: 'Wesley',
    nameLast: 'Bosman',
    email: 'wesley@example.co.za',
  });

  assert.equal(fields.merchant_key, undefined, 'merchant_key must not be sent to the browser');
  assert.ok(fields.signature, 'a signature must be present');
  assert.equal(fields.merchant_id, '10000100');
  assert.equal(fields.amount, '350.00', 'amount must carry exactly two decimals');
  assert.equal(fields.m_payment_id, 'TKT-ABC123');
  assert.equal(fields.notify_url, 'https://connect.example.co.za/api/payfast/itn');
});

test('amounts are always formatted to two decimal places', () => {
  const config = loadPayFastConfig({ PAYFAST_MODE: 'sandbox' } as NodeJS.ProcessEnv);
  const build = (amountZAR: number) =>
    buildPaymentFields(config, {
      reference: 'DON-1',
      amountZAR,
      itemName: 'Donation',
      nameFirst: 'A',
      nameLast: 'B',
      email: 'a@b.co.za',
    }).amount;

  assert.equal(build(100), '100.00');
  assert.equal(build(99.5), '99.50');
  assert.equal(build(0.99), '0.99');
});

test('non-positive amounts are rejected before reaching PayFast', () => {
  const config = loadPayFastConfig({ PAYFAST_MODE: 'sandbox' } as NodeJS.ProcessEnv);
  const build = (amountZAR: number) =>
    buildPaymentFields(config, {
      reference: 'DON-1',
      amountZAR,
      itemName: 'Donation',
      nameFirst: 'A',
      nameLast: 'B',
      email: 'a@b.co.za',
    });

  assert.throws(() => build(0), /positive/);
  assert.throws(() => build(-50), /positive/);
  assert.throws(() => build(Number.NaN), /positive/);
});

test('sandbox mode never uses live merchant credentials', () => {
  const config = loadPayFastConfig({
    PAYFAST_MODE: 'sandbox',
    PAYFAST_MERCHANT_ID: '99999999',
    PAYFAST_MERCHANT_KEY: 'a-real-live-key',
  } as NodeJS.ProcessEnv);

  assert.equal(config.merchantId, '10000100', 'sandbox must fall back to the test merchant');
  assert.notEqual(config.merchantKey, 'a-real-live-key');
  assert.equal(config.isConfigured, true, 'credentials are still reported as present');
  assert.equal(processUrl(config), 'https://sandbox.payfast.co.za/eng/process');
});

test('live mode uses the configured merchant credentials and live host', () => {
  const config = loadPayFastConfig({
    PAYFAST_MODE: 'live',
    PAYFAST_MERCHANT_ID: '99999999',
    PAYFAST_MERCHANT_KEY: 'a-real-live-key',
  } as NodeJS.ProcessEnv);

  assert.equal(config.merchantId, '99999999');
  assert.equal(config.merchantKey, 'a-real-live-key');
  assert.equal(processUrl(config), 'https://www.payfast.co.za/eng/process');
});

test('item_name is truncated to PayFast\'s 100 character limit', () => {
  const config = loadPayFastConfig({ PAYFAST_MODE: 'sandbox' } as NodeJS.ProcessEnv);
  const fields = buildPaymentFields(config, {
    reference: 'TKT-1',
    amountZAR: 350,
    itemName: 'x'.repeat(250),
    nameFirst: 'A',
    nameLast: 'B',
    email: 'a@b.co.za',
  });

  assert.equal(fields.item_name.length, 100);
});

/**
 * The two PAYFAST_SKIP_* flags each remove one of the four ITN checks. They
 * exist so a developer can test without a public tunnel, and the usual way
 * they reach production is a .env copied off a laptop — so live mode refuses
 * them rather than trusting the environment to be clean.
 */
test('live mode ignores the ITN test-skip flags', () => {
  const live = loadPayFastConfig({
    PAYFAST_MODE: 'live',
    PAYFAST_MERCHANT_ID: '10000100',
    PAYFAST_MERCHANT_KEY: '46f0cd694581a',
    PAYFAST_SKIP_IP_CHECK: 'true',
    PAYFAST_SKIP_SERVER_CONFIRM: 'true',
  } as NodeJS.ProcessEnv);

  assert.equal(live.skipIpCheck, false, 'live must verify the ITN source IP');
  assert.equal(live.skipServerConfirm, false, 'live must confirm the ITN with PayFast');
});

test('sandbox still honours the skip flags, so local testing keeps working', () => {
  const sandbox = loadPayFastConfig({
    PAYFAST_MODE: 'sandbox',
    PAYFAST_SKIP_IP_CHECK: 'true',
    PAYFAST_SKIP_SERVER_CONFIRM: 'true',
  } as NodeJS.ProcessEnv);

  assert.equal(sandbox.skipIpCheck, true);
  assert.equal(sandbox.skipServerConfirm, true);
});

/**
 * Browser origin vs API origin.
 *
 * Splitting the client and the API across two hosts is a normal deployment —
 * a static host serving the build, the API behind a rewrite. The return URLs
 * must address the browser's host, but the ITN must address the API directly:
 * PayFast signs the notification and the handler verifies that signature over
 * the raw body, so a proxy hop that re-encodes it fails the check after the
 * money has already moved.
 */
test('API_URL sends the ITN to the API host, leaving return URLs on the site', () => {
  const config = loadPayFastConfig({
    PAYFAST_MODE: 'sandbox',
    APP_URL: 'https://scconnect.co.za',
    API_URL: 'https://api.scconnect.co.za',
  } as NodeJS.ProcessEnv);

  const fields = buildPaymentFields(config, {
    reference: 'TKT-TEST',
    amountZAR: 450,
    itemName: 'Ticket',
    itemDescription: 'One seat',
    nameFirst: 'Thandi',
    nameLast: 'Nkosi',
    email: 'thandi@example.co.za',
  });

  assert.equal(fields.notify_url, 'https://api.scconnect.co.za/api/payfast/itn');
  assert.equal(fields.return_url, 'https://scconnect.co.za/payment/return');
  assert.equal(fields.cancel_url, 'https://scconnect.co.za/payment/cancel');
});

test('without API_URL both fall back to APP_URL, so single-origin deploys are unchanged', () => {
  const config = loadPayFastConfig({
    PAYFAST_MODE: 'sandbox',
    APP_URL: 'https://scconnect.co.za',
  } as NodeJS.ProcessEnv);

  assert.equal(config.apiUrl, 'https://scconnect.co.za');

  const fields = buildPaymentFields(config, {
    reference: 'TKT-TEST',
    amountZAR: 450,
    itemName: 'Ticket',
    itemDescription: 'One seat',
    nameFirst: 'Thandi',
    nameLast: 'Nkosi',
    email: 'thandi@example.co.za',
  });

  assert.equal(fields.notify_url, 'https://scconnect.co.za/api/payfast/itn');
});

test('a trailing slash on API_URL does not produce a double slash in the ITN URL', () => {
  const config = loadPayFastConfig({
    PAYFAST_MODE: 'sandbox',
    APP_URL: 'https://scconnect.co.za',
    API_URL: 'https://api.scconnect.co.za/',
  } as NodeJS.ProcessEnv);

  assert.equal(config.apiUrl, 'https://api.scconnect.co.za');
});

/**
 * Applications stay open when payments cannot be taken.
 *
 * The client wants to collect and review applications while payment is still
 * being set up. The danger is the sandbox fallback: with no real credentials
 * loadPayFastConfig uses PayFast's public test merchant, so an approved
 * applicant would be emailed a link to a test gateway and told their seat was
 * secured once it cleared. Payments therefore default to closed until real
 * credentials exist.
 */
test('payments are closed when no real credentials are set', () => {
  const config = loadPayFastConfig({ PAYFAST_MODE: 'sandbox' } as NodeJS.ProcessEnv);
  assert.equal(config.isConfigured, false);
  assert.equal(config.paymentsOpen, false, 'the sandbox fallback must not count as ready to charge');
});

test('payments open once real credentials are present', () => {
  const config = loadPayFastConfig({
    PAYFAST_MODE: 'live',
    PAYFAST_MERCHANT_ID: '10000100',
    PAYFAST_MERCHANT_KEY: '46f0cd694581a',
  } as NodeJS.ProcessEnv);
  assert.equal(config.paymentsOpen, true);
});

test('PAYMENTS_OPEN=false holds payments shut even with credentials', () => {
  // Lets the client gather applications before opening the gateway.
  const config = loadPayFastConfig({
    PAYFAST_MODE: 'live',
    PAYFAST_MERCHANT_ID: '10000100',
    PAYFAST_MERCHANT_KEY: '46f0cd694581a',
    PAYMENTS_OPEN: 'false',
  } as NodeJS.ProcessEnv);
  assert.equal(config.isConfigured, true);
  assert.equal(config.paymentsOpen, false);
});

test('PAYMENTS_OPEN=true opens sandbox, so an end-to-end test payment is possible', () => {
  const config = loadPayFastConfig({
    PAYFAST_MODE: 'sandbox',
    PAYMENTS_OPEN: 'true',
  } as NodeJS.ProcessEnv);
  assert.equal(config.paymentsOpen, true);
});
