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

import { timingSafeCompare } from '../src/server/app.ts';

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
