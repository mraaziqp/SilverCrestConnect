/**
 * Input validation for the public endpoints.
 *
 * Everything crossing the network boundary is untrusted, including the amount
 * on a donation. Each helper returns a trimmed, length-capped value or records
 * a field error, so a handler can collect all problems and answer in one go.
 */

export class FieldErrors {
  private errors: Record<string, string> = {};

  add(field: string, message: string): void {
    if (!this.errors[field]) this.errors[field] = message;
  }

  get any(): boolean {
    return Object.keys(this.errors).length > 0;
  }

  get all(): Record<string, string> {
    return { ...this.errors };
  }
}

/** RFC-5322-lite. Deliberately permissive; the confirmation email is the real check. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** SA numbers, with or without +27, allowing spaces, dashes and brackets. */
const PHONE_RE = /^[+()\d][\d\s()-]{6,19}$/;

export function requiredString(
  errors: FieldErrors,
  field: string,
  value: unknown,
  opts: { min?: number; max: number; label: string },
): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  const min = opts.min ?? 1;

  if (raw.length === 0) {
    errors.add(field, `${opts.label} is required.`);
    return '';
  }
  if (raw.length < min) {
    errors.add(field, `${opts.label} must be at least ${min} characters.`);
    return raw;
  }
  if (raw.length > opts.max) {
    errors.add(field, `${opts.label} must be ${opts.max} characters or fewer.`);
    return raw.slice(0, opts.max);
  }
  return raw;
}

export function optionalString(value: unknown, max: number): string | undefined {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return undefined;
  return raw.length > max ? raw.slice(0, max) : raw;
}

export function email(errors: FieldErrors, field: string, value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    errors.add(field, 'Email address is required.');
    return '';
  }
  if (raw.length > 100 || !EMAIL_RE.test(raw)) {
    errors.add(field, 'Enter a valid email address.');
    return raw.slice(0, 100);
  }
  return raw;
}

export function phone(errors: FieldErrors, field: string, value: unknown, required = true): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    if (required) errors.add(field, 'Contact number is required.');
    return '';
  }
  if (!PHONE_RE.test(raw)) {
    errors.add(field, 'Enter a valid contact number.');
  }
  return raw.slice(0, 20);
}

/**
 * Parses a money amount into rands with 2dp.
 * Rejects NaN, Infinity, negatives and anything outside the allowed band —
 * this is the only thing standing between the donate box and a R0.01 or
 * R99,999,999 transaction.
 */
export function money(
  errors: FieldErrors,
  field: string,
  value: unknown,
  opts: { min: number; max: number; label: string },
): number {
  const num = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').replace(/[,\s]/g, ''));

  if (!Number.isFinite(num)) {
    errors.add(field, `Enter a valid ${opts.label.toLowerCase()}.`);
    return 0;
  }
  const rounded = Math.round(num * 100) / 100;
  if (rounded < opts.min) {
    errors.add(field, `${opts.label} must be at least R${opts.min}.`);
    return rounded;
  }
  if (rounded > opts.max) {
    errors.add(field, `${opts.label} cannot exceed R${opts.max.toLocaleString('en-ZA')}.`);
    return rounded;
  }
  return rounded;
}

/** Splits a full name into the first/last pair PayFast expects. */
export function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}
