/**
 * Admin token comparison.
 *
 * The original implementation padded the supplied token to the expected
 * *character* length, then handed both to timingSafeEqual as *byte* buffers.
 * Any non-ASCII character makes those two lengths diverge, timingSafeEqual
 * throws on mismatched buffers, and an authentication failure becomes a 500
 * instead of a 401. These pin the behaviour down.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  timingSafeCompare,
  isLockedOut,
  recordAdminFailure,
  clearAdminFailures,
  clientKey,
} from '../src/server/app.ts';

test('an exact match is accepted', () => {
  assert.equal(timingSafeCompare('correct-token', 'correct-token'), true);
});

test('a wrong token of the same length is rejected', () => {
  assert.equal(timingSafeCompare('aaaaaaaaaaaa', 'bbbbbbbbbbbb'), false);
});

test('a wrong token of a different length is rejected, not thrown', () => {
  assert.equal(timingSafeCompare('short', 'a-much-longer-expected-token'), false);
  assert.equal(timingSafeCompare('a-much-longer-supplied-token', 'short'), false);
});

test('an empty supplied token is rejected', () => {
  assert.equal(timingSafeCompare('', 'expected-token'), false);
});

test('non-ASCII tokens compare without throwing', () => {
  // The original implementation threw a RangeError here, surfacing as a 500.
  assert.doesNotThrow(() => timingSafeCompare('tökén-wîth-áccents', 'expected'));
  assert.equal(timingSafeCompare('tökén-wîth-áccents', 'expected'), false);
  assert.equal(timingSafeCompare('tökén-wîth-áccents', 'tökén-wîth-áccents'), true);
});

test('a multi-byte token matching itself is accepted', () => {
  const token = '密码-🔐-token';
  assert.equal(timingSafeCompare(token, token), true);
  assert.equal(timingSafeCompare(token, '密码-🔐-tokes'), false);
});

test('a prefix of the real token is rejected', () => {
  // Guards against any accidental startsWith-style comparison.
  assert.equal(timingSafeCompare('secret', 'secret-token-full'), false);
});

/**
 * Brute-force brake on the admin gate.
 *
 * The gate holds a single shared token, so a guessable one is only as safe as
 * the number of guesses allowed. These pin down that failures are what count:
 * the dashboard issues many authorised calls per page, and throttling those
 * would lock out the admin long before it slowed anyone down.
 */
test('repeated failures from one address eventually lock it out', () => {
  const ip = '198.51.100.1';
  clearAdminFailures(ip);

  for (let i = 0; i < 9; i += 1) {
    recordAdminFailure(ip);
    assert.equal(isLockedOut(ip), false, `locked out early, after ${i + 1} failures`);
  }

  recordAdminFailure(ip);
  assert.equal(isLockedOut(ip), true, 'the tenth failure must lock the address out');

  clearAdminFailures(ip);
});

test('a correct token clears the tally, so near-misses do not accumulate', () => {
  const ip = '198.51.100.2';
  clearAdminFailures(ip);

  for (let i = 0; i < 9; i += 1) recordAdminFailure(ip);
  clearAdminFailures(ip); // stands in for a successful sign-in
  assert.equal(isLockedOut(ip), false);

  // The count restarted, so nine more failures still must not lock it out.
  for (let i = 0; i < 9; i += 1) recordAdminFailure(ip);
  assert.equal(isLockedOut(ip), false, 'the tally must reset on success, not carry over');

  clearAdminFailures(ip);
});

test('addresses are tracked separately, so one attacker cannot lock out the admin', () => {
  const attacker = '198.51.100.3';
  const admin = '198.51.100.4';
  clearAdminFailures(attacker);
  clearAdminFailures(admin);

  for (let i = 0; i < 15; i += 1) recordAdminFailure(attacker);

  assert.equal(isLockedOut(attacker), true);
  assert.equal(isLockedOut(admin), false, 'a stranger must not be able to lock the admin out');

  clearAdminFailures(attacker);
});

/**
 * Caller identity for throttling.
 *
 * When the client is hosted apart from the API, browser traffic arrives via a
 * second proxy and req.ip is that proxy — one bucket for every visitor. These
 * pin down that the throttles key on the original client instead.
 */
const fakeReq = (headers: Record<string, string>, ip?: string) =>
  ({
    get: (name: string) => headers[name.toLowerCase()],
    ip,
  }) as unknown as Parameters<typeof clientKey>[0];

test('the original client is taken from the left of X-Forwarded-For', () => {
  const key = clientKey(fakeReq({ 'x-forwarded-for': '203.0.113.7, 70.132.0.1' }, '70.132.0.1'));
  assert.equal(key, '203.0.113.7', 'must be the visitor, not the proxy in front of us');
});

test('two visitors behind one proxy get different keys', () => {
  const a = clientKey(fakeReq({ 'x-forwarded-for': '203.0.113.7, 70.132.0.1' }, '70.132.0.1'));
  const b = clientKey(fakeReq({ 'x-forwarded-for': '203.0.113.99, 70.132.0.1' }, '70.132.0.1'));
  assert.notEqual(a, b, 'a shared proxy must not mean a shared rate-limit bucket');
});

test('whitespace around the forwarded address is ignored', () => {
  assert.equal(clientKey(fakeReq({ 'x-forwarded-for': '  203.0.113.7  , 70.132.0.1' })), '203.0.113.7');
});

test('without the header it falls back to the socket address', () => {
  assert.equal(clientKey(fakeReq({}, '198.51.100.5')), '198.51.100.5');
});

test('an empty forwarded header does not produce an empty key', () => {
  // Every caller would otherwise share the "" bucket.
  assert.equal(clientKey(fakeReq({ 'x-forwarded-for': '' }, '198.51.100.5')), '198.51.100.5');
  assert.equal(clientKey(fakeReq({ 'x-forwarded-for': ' , 70.132.0.1' }, '198.51.100.5')), '198.51.100.5');
  assert.equal(clientKey(fakeReq({}, undefined)), 'unknown');
});
