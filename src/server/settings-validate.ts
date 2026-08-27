/**
 * Validation for admin-editable event settings.
 *
 * The settings endpoint previously wrote `req.body` straight into the store.
 * Being admin-only, that is not an unauthenticated hole — but it is a live
 * footgun: a typo in the dashboard could persist `ticketPriceZAR: "free"` or
 * `capacity: -5` and break checkout for everyone, and unknown keys accumulated
 * in the datastore forever.
 *
 * Two jobs here:
 *   1. Whitelist and type-check every field, capping lengths and ranges.
 *   2. DERIVE the display fields (dateLabel, timeLabel, startsAtISO, fullName)
 *      from their primitives, so they can never disagree with each other.
 *      Editing `date` alone used to leave `dateLabel` showing the old date.
 */

import type { EventSettings } from '../types.js';

export interface SettingsValidationResult {
  settings: Partial<EventSettings>;
  errors: Record<string, string>;
}

/** Text fields, with the maximum length each is allowed to reach. */
const TEXT_FIELDS: Record<string, number> = {
  name: 80,
  edition: 12,
  tagline: 160,
  presentedBy: 120,
  companyName: 120,
  city: 80,
  venue: 160,
  venueCity: 120,
  heroParagraph: 600,
  aboutTitle: 160,
  aboutLead: 600,
  aboutBody: 2000,
  cause: 200,
  causeShort: 120,
  galleryHeading: 120,
  galleryBody: 600,
  footerNote: 600,
  copyrightText: 200,
  contactPhone: 40,
  timezone: 64,
};

/** Whole-number fields, with their permitted range. */
const NUMBER_FIELDS: Record<string, { min: number; max: number }> = {
  ticketPriceZAR: { min: 0, max: 100_000 },
  capacity: { min: 1, max: 10_000 },
  capacityMin: { min: 1, max: 10_000 },
  capacityMax: { min: 1, max: 10_000 },
};

const URL_FIELDS = ['website', 'companyWebsite', 'customLogoUrl'] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Accepts http(s) and inline images only.
 *
 * The logo URL is rendered into an `<img src>`, so a `javascript:` scheme has
 * no business being stored even though modern browsers ignore it there.
 */
function isSafeUrl(value: string): boolean {
  if (value.startsWith('data:image/')) return true;
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "2026-10-23" -> "23 October 2026". Returns null on an invalid date. */
export function formatDateLabel(isoDate: string): string | null {
  if (!DATE_RE.test(isoDate)) return null;
  const [year, month, day] = isoDate.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Round-trip through Date to reject impossible dates like 2026-02-31.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;

  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/**
 * Validates a settings patch and returns only the fields that passed, with
 * derived fields recomputed. `current` supplies the values a derived field
 * needs when the patch does not include them.
 */
export function validateSettings(
  patch: unknown,
  current: EventSettings,
): SettingsValidationResult {
  const errors: Record<string, string> = {};
  const out: Partial<EventSettings> = {};

  if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
    return { settings: {}, errors: { _: 'Expected an object of settings.' } };
  }

  const body = patch as Record<string, unknown>;

  // Unknown keys are dropped rather than persisted. Silently ignoring them
  // would hide a dashboard bug, so they are reported.
  const known = new Set([
    ...Object.keys(TEXT_FIELDS),
    ...Object.keys(NUMBER_FIELDS),
    ...URL_FIELDS,
    'contactEmail',
    'date',
    'startTime',
    'endTime',
    // Derived — accepted but recomputed, so a stale value cannot stick.
    'fullName',
    'dateLabel',
    'timeLabel',
    'startsAtISO',
  ]);
  for (const key of Object.keys(body)) {
    if (!known.has(key)) errors[key] = 'Unknown setting; ignored.';
  }

  // ---- text
  for (const [field, max] of Object.entries(TEXT_FIELDS)) {
    if (!(field in body)) continue;
    const raw = body[field];
    if (typeof raw !== 'string') {
      errors[field] = 'Must be text.';
      continue;
    }
    const value = raw.trim();
    if (value.length > max) {
      errors[field] = `Must be ${max} characters or fewer.`;
      continue;
    }
    (out as Record<string, unknown>)[field] = value;
  }

  // ---- numbers
  for (const [field, range] of Object.entries(NUMBER_FIELDS)) {
    if (!(field in body)) continue;
    const raw = body[field];
    const num = typeof raw === 'number' ? raw : Number.parseFloat(String(raw));

    if (!Number.isFinite(num)) {
      errors[field] = 'Must be a number.';
      continue;
    }
    if (num < range.min || num > range.max) {
      errors[field] = `Must be between ${range.min} and ${range.max}.`;
      continue;
    }
    // Money is stored to the cent; counts must be whole.
    (out as Record<string, unknown>)[field] =
      field === 'ticketPriceZAR' ? Math.round(num * 100) / 100 : Math.round(num);
  }

  // ---- urls
  for (const field of URL_FIELDS) {
    if (!(field in body)) continue;
    const raw = body[field];
    if (typeof raw !== 'string') {
      errors[field] = 'Must be a URL.';
      continue;
    }
    const value = raw.trim();
    if (value === '') {
      (out as Record<string, unknown>)[field] = '';
      continue;
    }
    if (!isSafeUrl(value)) {
      errors[field] = 'Must be an http(s) URL or an inline image.';
      continue;
    }
    if (value.length > 200_000) {
      errors[field] = 'Image is too large; upload it and store the URL instead.';
      continue;
    }
    (out as Record<string, unknown>)[field] = value;
  }

  // ---- email
  if ('contactEmail' in body) {
    const raw = typeof body.contactEmail === 'string' ? body.contactEmail.trim() : '';
    if (!raw || !EMAIL_RE.test(raw) || raw.length > 100) {
      errors.contactEmail = 'Enter a valid email address.';
    } else {
      out.contactEmail = raw;
    }
  }

  // ---- date and times, with their derived labels
  if ('date' in body) {
    const raw = typeof body.date === 'string' ? body.date.trim() : '';
    const label = formatDateLabel(raw);
    if (!label) {
      errors.date = 'Enter a valid date as YYYY-MM-DD.';
    } else {
      out.date = raw;
      out.dateLabel = label;
    }
  }

  for (const field of ['startTime', 'endTime'] as const) {
    if (!(field in body)) continue;
    const raw = typeof body[field] === 'string' ? (body[field] as string).trim() : '';
    if (!TIME_RE.test(raw)) {
      errors[field] = 'Enter a valid 24-hour time as HH:MM.';
      continue;
    }
    out[field] = raw;
  }

  // Recompute anything that depends on the above, using the patched value
  // where one was supplied and the stored value otherwise. This is what stops
  // dateLabel and startsAtISO drifting away from date.
  const effectiveDate = out.date ?? current.date;
  const effectiveStart = out.startTime ?? current.startTime;
  const effectiveEnd = out.endTime ?? current.endTime;

  if (out.startTime !== undefined || out.endTime !== undefined) {
    out.timeLabel = `${effectiveStart} – ${effectiveEnd}`;
  }
  if (out.date !== undefined || out.startTime !== undefined) {
    // SAST is UTC+2 year-round; South Africa observes no daylight saving.
    out.startsAtISO = `${effectiveDate}T${effectiveStart}:00+02:00`;
  }
  if (out.name !== undefined || out.edition !== undefined) {
    const name = out.name ?? current.name;
    const edition = out.edition ?? current.edition;
    out.fullName = edition ? `${name} ${edition}` : name;
  }

  // capacityMin must not exceed capacityMax, whichever of them changed.
  const min = out.capacityMin ?? current.capacityMin;
  const max = out.capacityMax ?? current.capacityMax;
  if (min > max) {
    errors.capacityMin = 'The minimum target cannot exceed the maximum.';
    delete out.capacityMin;
    delete out.capacityMax;
  }

  return { settings: out, errors };
}

/** Trims and caps a list of editable content items. */
export function validateItems<T>(
  items: unknown,
  fields: Record<string, number>,
  maxItems = 50,
): { items: T[]; error?: string } {
  if (!Array.isArray(items)) {
    return { items: [], error: 'Expected a list of items.' };
  }
  if (items.length > maxItems) {
    return { items: [], error: `No more than ${maxItems} items.` };
  }

  const cleaned: T[] = [];
  for (const raw of items) {
    if (typeof raw !== 'object' || raw === null) continue;
    const source = raw as Record<string, unknown>;
    const item: Record<string, string> = {};

    for (const [field, max] of Object.entries(fields)) {
      const value = source[field];
      item[field] = typeof value === 'string' ? value.trim().slice(0, max) : '';
    }
    // Skip entries where every field came back empty.
    // The field map guarantees every declared key is present as a string, so
    // the shape matches the caller's item type by construction.
    if (Object.values(item).some((v) => v !== '')) cleaned.push(item as T);
  }

  return { items: cleaned };
}
