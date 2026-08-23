import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatZAR } from '../src/lib/api.ts';

test('formatZAR renders whole rands tight against the symbol', () => {
  assert.equal(formatZAR(350), 'R350');
  assert.equal(formatZAR(0), 'R0');
});

test('formatZAR uses a period for decimals, matching PayFast', () => {
  assert.equal(formatZAR(0.99, true), 'R0.99');
  assert.equal(formatZAR(350, true), 'R350.00');
  assert.equal(formatZAR(1234.5, true), 'R1 234.50');
});

test('formatZAR groups thousands with a space', () => {
  assert.equal(formatZAR(100000), 'R100 000');
  assert.equal(formatZAR(1234567), 'R1 234 567');
});

test('formatZAR handles negatives and non-finite input', () => {
  assert.equal(formatZAR(-250, true), '-R250.00');
  assert.equal(formatZAR(Number.NaN), 'R0');
});
