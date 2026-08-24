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
