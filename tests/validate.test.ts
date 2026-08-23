/**
 * Validation tests.
 *
 * These guard the boundary where untrusted input becomes a payment amount or
 * a stored record. The money() cases matter most: the donate box is the one
 * place a visitor names a number, and it must never reach PayFast unbounded.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FieldErrors,
  email,
  money,
  optionalString,
  phone,
  requiredString,
  splitName,
} from '../src/server/validate.ts';

test('requiredString rejects empty and enforces a minimum', () => {
  const e = new FieldErrors();
  assert.equal(requiredString(e, 'name', '', { max: 50, label: 'Name' }), '');
  assert.equal(e.all.name, 'Name is required.');

  const e2 = new FieldErrors();
  requiredString(e2, 'about', 'too short', { min: 20, max: 500, label: 'About' });
  assert.match(e2.all.about, /at least 20 characters/);
});

test('requiredString trims and caps length rather than truncating silently', () => {
  const e = new FieldErrors();
  const value = requiredString(e, 'name', '  Padded  ', { max: 50, label: 'Name' });
  assert.equal(value, 'Padded');
  assert.equal(e.any, false);

  const e2 = new FieldErrors();
  const long = requiredString(e2, 'name', 'x'.repeat(80), { max: 50, label: 'Name' });
  assert.equal(long.length, 50);
  assert.match(e2.all.name, /50 characters or fewer/);
});

test('requiredString rejects non-string input', () => {
  const e = new FieldErrors();
  // A JSON body can carry anything: numbers, objects, null.
  assert.equal(requiredString(e, 'name', { evil: true }, { max: 50, label: 'Name' }), '');
  assert.equal(requiredString(e, 'n2', 12345, { max: 50, label: 'N2' }), '');
  assert.equal(requiredString(e, 'n3', null, { max: 50, label: 'N3' }), '');
  assert.equal(Object.keys(e.all).length, 3);
});

test('email accepts real addresses and rejects malformed ones', () => {
  for (const good of ['a@b.co.za', 'wesley.bosman@silvercrest.co.za', 'x+tag@example.com']) {
    const e = new FieldErrors();
    assert.equal(email(e, 'email', good), good, `${good} should be accepted`);
    assert.equal(e.any, false);
  }

  for (const bad of ['', 'not-an-email', 'a@b', '@b.co.za', 'a b@c.co.za', 'a@.co']) {
    const e = new FieldErrors();
    email(e, 'email', bad);
    assert.equal(e.any, true, `${bad} should be rejected`);
  }
});

test('phone accepts SA formats and rejects junk', () => {
  for (const good of ['+27 82 555 0100', '0215550199', '(021) 555-0199', '+27825550100']) {
    const e = new FieldErrors();
    phone(e, 'phone', good);
    assert.equal(e.any, false, `${good} should be accepted`);
  }

  for (const bad of ['123', 'call me', '']) {
    const e = new FieldErrors();
    phone(e, 'phone', bad);
    assert.equal(e.any, true, `${bad} should be rejected`);
  }
});

test('phone may be optional', () => {
  const e = new FieldErrors();
  phone(e, 'phone', '', false);
  assert.equal(e.any, false);
});

test('money rejects everything that is not a sane amount', () => {
  const opts = { min: 10, max: 100000, label: 'Donation amount' };

  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0, 9.99, 100001, 'abc', null, undefined, {}]) {
    const e = new FieldErrors();
    money(e, 'amount', bad, opts);
    assert.equal(e.any, true, `${String(bad)} should be rejected`);
  }
});

test('money accepts valid amounts and rounds to cents', () => {
  const opts = { min: 10, max: 100000, label: 'Donation amount' };

  const e = new FieldErrors();
  assert.equal(money(e, 'amount', 250, opts), 250);
  assert.equal(money(e, 'amount', '1000', opts), 1000);
  assert.equal(money(e, 'amount', '1 000', opts), 1000);
  assert.equal(money(e, 'amount', '1,500.50', opts), 1500.5);
  assert.equal(money(e, 'amount', 99.999, opts), 100);
  assert.equal(e.any, false);
});

test('money accepts exactly the boundary values', () => {
  const opts = { min: 10, max: 100000, label: 'Donation amount' };
  const e = new FieldErrors();
  assert.equal(money(e, 'a', 10, opts), 10);
  assert.equal(money(e, 'b', 100000, opts), 100000);
  assert.equal(e.any, false);
});

test('optionalString returns undefined rather than an empty string', () => {
  assert.equal(optionalString('', 100), undefined);
  assert.equal(optionalString('   ', 100), undefined);
  assert.equal(optionalString(null, 100), undefined);
  assert.equal(optionalString('  kept  ', 100), 'kept');
  assert.equal(optionalString('x'.repeat(200), 100)?.length, 100);
});

test('FieldErrors keeps the first message per field', () => {
  const e = new FieldErrors();
  e.add('name', 'first');
  e.add('name', 'second');
  assert.equal(e.all.name, 'first');
});

test('splitName produces the first/last pair PayFast expects', () => {
  assert.deepEqual(splitName('Wesley Bosman'), { first: 'Wesley', last: 'Bosman' });
  assert.deepEqual(splitName('Nadia van der Merwe'), { first: 'Nadia', last: 'van der Merwe' });
  // PayFast requires both fields, so a single name is duplicated rather than
  // sent with an empty last name.
  assert.deepEqual(splitName('Saadiqah'), { first: 'Saadiqah', last: 'Saadiqah' });
  assert.deepEqual(splitName('  Spaced   Out  '), { first: 'Spaced', last: 'Out' });
});
