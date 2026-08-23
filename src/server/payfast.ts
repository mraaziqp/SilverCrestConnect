/**
 * PayFast (South Africa) integration.
 *
 * Two halves:
 *   1. buildPaymentFields() — signs an outbound payment request. The client
 *      renders the returned fields as a self-submitting form to PayFast.
 *   2. verifyItn() — validates an inbound Instant Transaction Notification.
 *
 * The merchant key and passphrase are secrets: they are read from the
 * environment, used only here on the server, and never serialised to the
 * client. The client only ever receives merchant_id plus a signature.
 *
 * Reference: PayFast developer docs, "Custom Integration" + "ITN".
 */

import crypto from 'crypto';
import dns from 'dns/promises';
import net from 'net';

export type PayFastMode = 'sandbox' | 'live';

const HOSTS = {
  sandbox: 'https://sandbox.payfast.co.za',
  live: 'https://www.payfast.co.za',
} as const;

/**
 * PayFast's documented sandbox merchant credentials. We fall back to these
 * when nothing is configured so the app is runnable out of the box, but
 * `isConfigured` stays false so the admin dashboard flags it.
 */
const SANDBOX_DEFAULTS = {
  merchantId: '10000100',
  merchantKey: '46f0cd694581a',
} as const;

/**
 * Field order matters: PayFast computes the signature over the fields in the
 * exact order they appear in the posted form, NOT alphabetically. This is the
 * canonical order from the PayFast custom-integration docs.
 */
const FIELD_ORDER = [
  'merchant_id',
  'merchant_key',
  'return_url',
  'cancel_url',
  'notify_url',
  'name_first',
  'name_last',
  'email_address',
  'cell_number',
  'm_payment_id',
  'amount',
  'item_name',
  'item_description',
  'custom_int1',
  'custom_int2',
  'custom_int3',
  'custom_int4',
  'custom_int5',
  'custom_str1',
  'custom_str2',
  'custom_str3',
  'custom_str4',
  'custom_str5',
  'email_confirmation',
  'confirmation_address',
  'payment_method',
] as const;

export interface PayFastConfig {
  mode: PayFastMode;
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  /** Public base URL of this app, used to build return/cancel/notify URLs. */
  appUrl: string;
  /** True when real credentials were supplied via the environment. */
  isConfigured: boolean;
  /** Skip the source-IP allowlist on ITN. Only for local testing. */
  skipIpCheck: boolean;
  /** Skip the server-to-server confirmation POST. Only for local testing. */
  skipServerConfirm: boolean;
}

export function loadPayFastConfig(env: NodeJS.ProcessEnv = process.env): PayFastConfig {
  const mode: PayFastMode = env.PAYFAST_MODE === 'live' ? 'live' : 'sandbox';
  const merchantId = (env.PAYFAST_MERCHANT_ID || '').trim();
  const merchantKey = (env.PAYFAST_MERCHANT_KEY || '').trim();

  const isConfigured = Boolean(merchantId && merchantKey);

  // Live credentials are only ever used in live mode. In sandbox we fall back
  // to PayFast's public test merchant unless sandbox-specific credentials were
  // supplied, so a stray PAYFAST_MODE flip cannot point the real merchant
  // account at the test gateway — or, worse, leave live keys in play during a
  // test run.
  const sandboxId = (env.PAYFAST_SANDBOX_MERCHANT_ID || '').trim() || SANDBOX_DEFAULTS.merchantId;
  const sandboxKey = (env.PAYFAST_SANDBOX_MERCHANT_KEY || '').trim() || SANDBOX_DEFAULTS.merchantKey;

  return {
    mode,
    merchantId: mode === 'live' ? merchantId || SANDBOX_DEFAULTS.merchantId : sandboxId,
    merchantKey: mode === 'live' ? merchantKey || SANDBOX_DEFAULTS.merchantKey : sandboxKey,
    passphrase: (env.PAYFAST_PASSPHRASE || '').trim(),
    appUrl: (env.APP_URL || 'http://localhost:3000').replace(/\/+$/, ''),
    isConfigured,
    skipIpCheck: env.PAYFAST_SKIP_IP_CHECK === 'true',
    skipServerConfirm: env.PAYFAST_SKIP_SERVER_CONFIRM === 'true',
  };
}

export function processUrl(config: PayFastConfig): string {
  return `${HOSTS[config.mode]}/eng/process`;
}

function validateUrl(config: PayFastConfig): string {
  return `${HOSTS[config.mode]}/eng/query/validate`;
}

/**
 * Percent-encoding that matches PHP's urlencode(), which is what PayFast's
 * reference implementation uses to build the signature string.
 *
 * Differences from encodeURIComponent: spaces become '+', and the characters
 * ! ' ( ) * ~ are escaped. Getting this wrong produces a signature mismatch on
 * any value containing them, and business names very often do.
 */
export function pfEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/[!'()*~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

/**
 * Builds the `key=value&key=value` string PayFast signs.
 * Empty values are omitted — PayFast excludes them from the signature.
 */
export function buildSignatureString(
  data: Record<string, string>,
  order: readonly string[],
  passphrase: string,
): string {
  const parts: string[] = [];

  for (const key of order) {
    const raw = data[key];
    if (raw === undefined || raw === null) continue;
    const value = String(raw).trim();
    if (value === '') continue;
    parts.push(`${key}=${pfEncode(value)}`);
  }

  let str = parts.join('&');
  if (passphrase) {
    str += `&passphrase=${pfEncode(passphrase)}`;
  }
  return str;
}

export function signPayload(
  data: Record<string, string>,
  order: readonly string[],
  passphrase: string,
): string {
  return crypto
    .createHash('md5')
    .update(buildSignatureString(data, order, passphrase))
    .digest('hex');
}

export interface BuildPaymentInput {
  /** Our own unique reference for this attempt (m_payment_id). */
  reference: string;
  amountZAR: number;
  itemName: string;
  itemDescription?: string;
  nameFirst: string;
  nameLast: string;
  email: string;
  cellNumber?: string;
  /** Round-tripped through PayFast so the ITN can be tied back to a record. */
  customStr1?: string;
  customStr2?: string;
}

/**
 * Produces the signed field set for a PayFast payment.
 * The returned map is safe to send to the browser: it contains merchant_id
 * and the signature, but never the merchant key or the passphrase.
 */
export function buildPaymentFields(
  config: PayFastConfig,
  input: BuildPaymentInput,
): Record<string, string> {
  if (!Number.isFinite(input.amountZAR) || input.amountZAR <= 0) {
    throw new Error('PayFast amount must be a positive number.');
  }

  // PayFast requires exactly two decimal places and rejects thousands separators.
  const amount = input.amountZAR.toFixed(2);

  // Signed with the merchant key present, then stripped before returning.
  const signable: Record<string, string> = {
    merchant_id: config.merchantId,
    merchant_key: config.merchantKey,
    return_url: `${config.appUrl}/payment/return`,
    cancel_url: `${config.appUrl}/payment/cancel`,
    notify_url: `${config.appUrl}/api/payfast/itn`,
    name_first: truncate(input.nameFirst, 100),
    name_last: truncate(input.nameLast, 100),
    email_address: truncate(input.email, 100),
    m_payment_id: input.reference,
    amount,
    // PayFast rejects item_name over 100 characters.
    item_name: truncate(input.itemName, 100),
  };

  if (input.cellNumber) signable.cell_number = truncate(input.cellNumber, 20);
  if (input.itemDescription) signable.item_description = truncate(input.itemDescription, 255);
  if (input.customStr1) signable.custom_str1 = truncate(input.customStr1, 255);
  if (input.customStr2) signable.custom_str2 = truncate(input.customStr2, 255);

  const signature = signPayload(signable, FIELD_ORDER, config.passphrase);

  // merchant_key is a secret and must not reach the browser. PayFast accepts
  // the form without it as long as the signature was computed with it.
  const { merchant_key: _omitted, ...publicFields } = signable;

  return { ...publicFields, signature };
}

function truncate(value: string, max: number): string {
  const v = (value || '').trim();
  return v.length > max ? v.slice(0, max) : v;
}

/**
 * PayFast posts ITNs from a fixed set of hosts. Resolving them on each call
 * (rather than hardcoding IPs) keeps the allowlist correct if PayFast
 * re-addresses its infrastructure.
 */
const ITN_HOSTNAMES = [
  'www.payfast.co.za',
  'sandbox.payfast.co.za',
  'w1w.payfast.co.za',
  'w2w.payfast.co.za',
];

async function isKnownPayFastIp(ip: string): Promise<boolean> {
  // Express may report IPv4 addresses in IPv4-mapped IPv6 form.
  const normalised = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (!net.isIP(normalised)) return false;

  const resolved = await Promise.all(
    ITN_HOSTNAMES.map((host) => dns.resolve4(host).catch(() => [] as string[])),
  );
  return resolved.flat().includes(normalised);
}

export interface ItnVerificationResult {
  valid: boolean;
  /** Why it failed. Stored on the payment record so failures are debuggable. */
  reason?: string;
}

export interface VerifyItnInput {
  /** Parsed ITN body. */
  body: Record<string, string>;
  /** Raw request body, used to recover the exact posted field order. */
  rawBody: string;
  sourceIp: string;
  /** The amount we expect, from our own record — not from the ITN. */
  expectedAmountZAR: number;
}

/**
 * Runs all four checks PayFast requires before an ITN may be trusted:
 *   1. signature matches
 *   2. request came from a PayFast host
 *   3. amount matches what we recorded
 *   4. PayFast itself confirms the payload (server-to-server POST back)
 *
 * Any single failure rejects the notification.
 */
export async function verifyItn(
  config: PayFastConfig,
  input: VerifyItnInput,
): Promise<ItnVerificationResult> {
  const { body, rawBody, sourceIp, expectedAmountZAR } = input;

  // 1. Signature. Rebuild the string from the raw POST order, excluding the
  // signature field itself — PayFast signs the fields in the order it sent them.
  const postedOrder = rawBody
    .split('&')
    .map((pair) => pair.split('=')[0])
    .filter((k) => k && k !== 'signature');

  if (!body.signature) {
    return { valid: false, reason: 'ITN carried no signature.' };
  }

  const expectedSignature = signPayload(body, postedOrder, config.passphrase);
  if (!timingSafeEqual(expectedSignature, body.signature)) {
    return { valid: false, reason: 'ITN signature mismatch.' };
  }

  // 2. Source IP.
  if (!config.skipIpCheck && !(await isKnownPayFastIp(sourceIp))) {
    return { valid: false, reason: `ITN from untrusted IP ${sourceIp}.` };
  }

  // 3. Amount. Compare against our stored figure, tolerating float noise.
  const reported = Number.parseFloat(body.amount_gross ?? '');
  if (!Number.isFinite(reported)) {
    return { valid: false, reason: 'ITN carried no parseable amount_gross.' };
  }
  if (Math.abs(reported - expectedAmountZAR) > 0.01) {
    return {
      valid: false,
      reason: `ITN amount R${reported.toFixed(2)} does not match expected R${expectedAmountZAR.toFixed(2)}.`,
    };
  }

  // 4. Ask PayFast to confirm it really sent this.
  if (!config.skipServerConfirm) {
    try {
      const res = await fetch(validateUrl(config), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: rawBody,
        signal: AbortSignal.timeout(10_000),
      });
      const text = (await res.text()).trim();
      if (text !== 'VALID') {
        return { valid: false, reason: `PayFast server confirmation returned "${text}".` };
      }
    } catch (err) {
      return {
        valid: false,
        reason: `PayFast server confirmation failed: ${(err as Error).message}`,
      };
    }
  }

  return { valid: true };
}

/** Constant-time comparison so signature checks do not leak timing information. */
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Non-secret view of the config for the admin dashboard. */
export function describeConfig(config: PayFastConfig) {
  const warnings: string[] = [];

  if (!config.isConfigured) {
    warnings.push(
      'No PayFast credentials found in the environment — running on PayFast sandbox test credentials.',
    );
  }
  if (config.mode === 'sandbox') {
    warnings.push(
      config.isConfigured
        ? 'Sandbox mode: your live merchant credentials are loaded but deliberately not in use. No real money can move. Set PAYFAST_MODE=live to go live.'
        : 'Sandbox mode: no real money can move.',
    );
  }
  if (config.mode === 'live' && !config.passphrase) {
    warnings.push(
      'Live mode without a passphrase. Set a passphrase in the PayFast dashboard and in PAYFAST_PASSPHRASE.',
    );
  }
  if (config.mode === 'live' && config.appUrl.startsWith('http://')) {
    warnings.push(
      'APP_URL is not HTTPS. PayFast will not deliver ITN callbacks to an insecure URL in live mode.',
    );
  }
  if (config.appUrl.includes('localhost')) {
    warnings.push(
      'APP_URL points at localhost, so PayFast cannot reach the ITN endpoint. Use a public URL or a tunnel when testing.',
    );
  }
  if (config.skipIpCheck) {
    warnings.push(
      'PAYFAST_SKIP_IP_CHECK is on — ITN source IPs are not being verified. Turn this off in production.',
    );
  }
  if (config.skipServerConfirm) {
    warnings.push(
      'PAYFAST_SKIP_SERVER_CONFIRM is on — ITNs are not confirmed with PayFast. Turn this off in production.',
    );
  }

  return {
    configured: config.isConfigured,
    mode: config.mode,
    merchantId: config.merchantId,
    merchantKeyMasked: maskKey(config.merchantKey),
    passphraseSet: Boolean(config.passphrase),
    processUrl: processUrl(config),
    notifyUrl: `${config.appUrl}/api/payfast/itn`,
    returnUrl: `${config.appUrl}/payment/return`,
    cancelUrl: `${config.appUrl}/payment/cancel`,
    warnings,
  };
}

function maskKey(key: string): string {
  if (!key) return '—';
  if (key.length <= 4) return '•'.repeat(key.length);
  return key.slice(0, 2) + '•'.repeat(Math.max(4, key.length - 4)) + key.slice(-2);
}
