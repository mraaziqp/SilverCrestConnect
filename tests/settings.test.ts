/**
 * Admin settings validation.
 *
 * The settings endpoint originally wrote request bodies straight into the
 * store, so a typo in the dashboard could persist a non-numeric ticket price
 * or a negative capacity. Worse, editing `date` on its own left `dateLabel`
 * showing the previous date, because the two were stored independently.
 *
 * These pin both behaviours down.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateSettings, validateItems, formatDateLabel } from '../src/server/settings-validate.ts';
import type { EventSettings } from '../src/types.ts';

const CURRENT = {
  name: 'Silver Crest Connect',
  edition: "'26",
  fullName: "Silver Crest Connect '26",
  tagline: 'Building Business. Strengthening Community.',
  companyName: 'Silver Crest Consulting',
  companyWebsite: 'https://scconsults.co.za',
  website: 'https://scconnect.co.za',
  contactEmail: 'connect@scconsults.co.za',
  contactPhone: '',
  date: '2026-10-23',
  dateLabel: '23 October 2026',
  startTime: '09:00',
  endTime: '13:00',
  timeLabel: '09:00 – 13:00',
  timezone: 'Africa/Johannesburg',
  startsAtISO: '2026-10-23T09:00:00+02:00',
  city: 'Cape Town',
  venue: 'Venue to be confirmed',
  venueCity: 'Cape Town, South Africa',
  heroParagraph: 'x',
  aboutTitle: 'x',
  aboutLead: 'x',
  aboutBody: 'x',
  ticketPriceZAR: 350,
  capacityMin: 15,
  capacityMax: 20,
  capacity: 20,
  cause: 'x',
  causeShort: 'x',
  footerNote: 'x',
  copyrightText: 'x',
} as EventSettings;

test('formatDateLabel renders a human date and rejects impossible ones', () => {
  assert.equal(formatDateLabel('2026-10-23'), '23 October 2026');
  assert.equal(formatDateLabel('2026-01-01'), '1 January 2026');
  assert.equal(formatDateLabel('2026-02-31'), null, '31 February is not a date');
  assert.equal(formatDateLabel('2026-13-01'), null);
  assert.equal(formatDateLabel('23/10/2026'), null);
  assert.equal(formatDateLabel(''), null);
});

test('changing the date recomputes its label and ISO instant', () => {
  const { settings, errors } = validateSettings({ date: '2026-11-15' }, CURRENT);

  assert.equal(errors.date, undefined);
  assert.equal(settings.date, '2026-11-15');
  // The whole point: these used to keep the old date.
  assert.equal(settings.dateLabel, '15 November 2026');
  assert.equal(settings.startsAtISO, '2026-11-15T09:00:00+02:00');
});

test('a stale derived value supplied by the client is overwritten, not trusted', () => {
  const { settings } = validateSettings(
    { date: '2026-11-15', dateLabel: 'Whatever I typed', startsAtISO: 'nonsense' },
    CURRENT,
  );
  assert.equal(settings.dateLabel, '15 November 2026');
  assert.equal(settings.startsAtISO, '2026-11-15T09:00:00+02:00');
});

test('changing the times recomputes the time label', () => {
  const { settings } = validateSettings({ startTime: '10:30', endTime: '15:00' }, CURRENT);
  assert.equal(settings.timeLabel, '10:30 – 15:00');
  assert.equal(settings.startsAtISO, '2026-10-23T10:30:00+02:00');
});

test('invalid times are rejected', () => {
  for (const bad of ['25:00', '9:00', 'morning', '09:70', '']) {
    const { errors } = validateSettings({ startTime: bad }, CURRENT);
    assert.ok(errors.startTime, `${bad} should be rejected`);
  }
});

test('a non-numeric ticket price is rejected rather than stored', () => {
  const { settings, errors } = validateSettings({ ticketPriceZAR: 'free' }, CURRENT);
  assert.equal(settings.ticketPriceZAR, undefined);
  assert.match(errors.ticketPriceZAR, /number/);
});

test('out-of-range numbers are rejected', () => {
  assert.ok(validateSettings({ capacity: -5 }, CURRENT).errors.capacity);
  assert.ok(validateSettings({ capacity: 0 }, CURRENT).errors.capacity);
  assert.ok(validateSettings({ ticketPriceZAR: 999_999 }, CURRENT).errors.ticketPriceZAR);
  assert.ok(validateSettings({ ticketPriceZAR: -1 }, CURRENT).errors.ticketPriceZAR);
});

test('valid numbers are accepted, with counts rounded and money kept to cents', () => {
  const { settings, errors } = validateSettings(
    { capacity: 30.6, ticketPriceZAR: 499.999, additionalRepPriceZAR: 249.999 },
    CURRENT,
  );
  assert.equal(errors.capacity, undefined);
  assert.equal(errors.additionalRepPriceZAR, undefined);
  assert.equal(settings.capacity, 31);
  assert.equal(settings.ticketPriceZAR, 500);
  assert.equal(settings.additionalRepPriceZAR, 250);
});

test('a numeric string from a form input is accepted', () => {
  // HTML number inputs hand back strings.
  const { settings, errors } = validateSettings({ capacity: '25' }, CURRENT);
  assert.equal(errors.capacity, undefined);
  assert.equal(settings.capacity, 25);
});

test('unknown keys are reported and never stored', () => {
  const { settings, errors } = validateSettings({ evilKey: 'x', __proto__: 'y' }, CURRENT);
  assert.equal((settings as Record<string, unknown>).evilKey, undefined);
  assert.ok(errors.evilKey);
});

test('capacityMin may not exceed capacityMax', () => {
  const { settings, errors } = validateSettings({ capacityMin: 50, capacityMax: 10 }, CURRENT);
  assert.ok(errors.capacityMin);
  assert.equal(settings.capacityMin, undefined);
  assert.equal(settings.capacityMax, undefined);
});

test('logo URLs are restricted to http(s) and inline images', () => {
  assert.equal(validateSettings({ customLogoUrl: 'javascript:alert(1)' }, CURRENT).errors.customLogoUrl !== undefined, true);
  assert.equal(validateSettings({ customLogoUrl: 'not a url' }, CURRENT).errors.customLogoUrl !== undefined, true);

  assert.equal(
    validateSettings({ customLogoUrl: 'https://firebasestorage.googleapis.com/logo.png' }, CURRENT).errors.customLogoUrl,
    undefined,
  );
  assert.equal(
    validateSettings({ customLogoUrl: 'data:image/png;base64,iVBORw0KGgo=' }, CURRENT).errors.customLogoUrl,
    undefined,
  );
  // Clearing the logo is allowed.
  assert.equal(validateSettings({ customLogoUrl: '' }, CURRENT).settings.customLogoUrl, '');
});

test('text fields are trimmed and length-capped', () => {
  const { settings, errors } = validateSettings({ venue: '  The Venue  ' }, CURRENT);
  assert.equal(settings.venue, 'The Venue');
  assert.equal(errors.venue, undefined);

  assert.ok(validateSettings({ venue: 'x'.repeat(500) }, CURRENT).errors.venue);
});

test('a bad contact email is rejected', () => {
  assert.ok(validateSettings({ contactEmail: 'not-an-email' }, CURRENT).errors.contactEmail);
  assert.equal(
    validateSettings({ contactEmail: 'hi@scconsults.co.za' }, CURRENT).settings.contactEmail,
    'hi@scconsults.co.za',
  );
});

test('renaming the event recomputes fullName', () => {
  const { settings } = validateSettings({ name: 'Silver Crest Summit' }, CURRENT);
  assert.equal(settings.fullName, "Silver Crest Summit '26");
});

test('a non-object body is rejected outright', () => {
  assert.ok(validateSettings('nope', CURRENT).errors._);
  assert.ok(validateSettings([1, 2], CURRENT).errors._);
  assert.ok(validateSettings(null, CURRENT).errors._);
});

// ------------------------------------------------------------------- items

test('validateItems trims, caps and drops empty rows', () => {
  const { items } = validateItems<{ title: string; body: string }>(
    [
      { title: '  Lanyard  ', body: 'A branded lanyard.' },
      { title: '', body: '' },
      { title: 'x'.repeat(500), body: 'ok' },
    ],
    { title: 120, body: 500 },
  );

  assert.equal(items.length, 2, 'the fully-empty row is dropped');
  assert.equal(items[0].title, 'Lanyard');
  assert.equal(items[1].title.length, 120);
});

test('validateItems rejects a non-array and an oversized list', () => {
  assert.ok(validateItems('nope', { title: 10 }).error);
  assert.ok(validateItems(Array(200).fill({ title: 'x' }), { title: 10 }).error);
});

test('validateItems ignores fields it was not told about', () => {
  const { items } = validateItems<{ title: string }>(
    [{ title: 'Kept', sneaky: 'dropped' }],
    { title: 50 },
  );
  assert.equal((items[0] as Record<string, unknown>).sneaky, undefined);
});
