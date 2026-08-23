/**
 * Outbound email.
 *
 * Two drivers behind one interface:
 *   - resend   real delivery via the Resend HTTP API
 *   - console  logs the message instead of sending it
 *
 * The console driver is the default and is what runs when no API key is
 * configured, so the whole funnel works end to end on a laptop without
 * anyone receiving mail. Nothing in the app has to know which is active.
 *
 * Sending never blocks or fails a request. If a receipt cannot be delivered
 * that is worth a loud log line, but it must not roll back a payment that
 * PayFast has already taken.
 */

import { EVENT } from '../../config/event.js';
import type { RenderedEmail } from './render.js';

export interface Mailer {
  readonly driver: 'resend' | 'console';
  readonly configured: boolean;
  readonly from: string;
  send(to: string, message: RenderedEmail): Promise<SendResult>;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
  /** True when the message was logged rather than delivered. */
  skipped?: boolean;
}

export interface MailerConfig {
  apiKey: string;
  /** e.g. "Silver Crest Connect <connect@silvercrestconsulting.co.za>" */
  from: string;
  /** Where applicant replies should land. */
  replyTo: string;
  /**
   * When set, every message is redirected here regardless of recipient.
   * Use on staging so a test run cannot email real applicants.
   */
  redirectTo: string;
}

export function loadMailerConfig(env: NodeJS.ProcessEnv = process.env): MailerConfig {
  const fromAddress = (env.EMAIL_FROM || EVENT.contactEmail).trim();
  const fromName = (env.EMAIL_FROM_NAME || EVENT.fullName).trim();

  return {
    apiKey: (env.RESEND_API_KEY || '').trim(),
    // Resend accepts a bare address, but a display name renders far better.
    from: fromAddress.includes('<') ? fromAddress : `${fromName} <${fromAddress}>`,
    replyTo: (env.EMAIL_REPLY_TO || EVENT.contactEmail).trim(),
    redirectTo: (env.EMAIL_REDIRECT_TO || '').trim(),
  };
}

export function createMailer(config: MailerConfig): Mailer {
  return config.apiKey ? new ResendMailer(config) : new ConsoleMailer(config);
}

/** Delivers through the Resend HTTP API. No SDK — one fetch call. */
class ResendMailer implements Mailer {
  readonly driver = 'resend' as const;
  readonly configured = true;

  constructor(private readonly config: MailerConfig) {}

  get from(): string {
    return this.config.from;
  }

  async send(to: string, message: RenderedEmail): Promise<SendResult> {
    const recipient = this.config.redirectTo || to;

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.config.from,
          to: [recipient],
          reply_to: this.config.replyTo,
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        // Resend returns a JSON body describing the problem; surface it, since
        // the usual cause is an unverified sender domain and that is fixable.
        const detail = await res.text().catch(() => '');
        return { ok: false, error: `Resend responded ${res.status}: ${detail.slice(0, 300)}` };
      }

      const body = (await res.json().catch(() => ({}))) as { id?: string };
      return { ok: true, id: body.id };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}

/** Logs instead of sending. Used until RESEND_API_KEY is configured. */
class ConsoleMailer implements Mailer {
  readonly driver = 'console' as const;
  readonly configured = false;

  constructor(private readonly config: MailerConfig) {}

  get from(): string {
    return this.config.from;
  }

  async send(to: string, message: RenderedEmail): Promise<SendResult> {
    console.log(
      [
        '',
        '┌─ EMAIL (not sent — RESEND_API_KEY is not set) ─────────────────',
        `│ To      : ${to}`,
        `│ From    : ${this.config.from}`,
        `│ Subject : ${message.subject}`,
        '├────────────────────────────────────────────────────────────────',
        message.text
          .trim()
          .split('\n')
          .map((line) => `│ ${line}`)
          .join('\n'),
        '└────────────────────────────────────────────────────────────────',
        '',
      ].join('\n'),
    );
    return { ok: true, skipped: true };
  }
}

/**
 * Fire-and-forget wrapper.
 *
 * Callers use this rather than awaiting send() directly: a payment must be
 * recorded even if the receipt bounces, and an applicant must not see a 500
 * because a mail API was briefly down.
 */
export function sendInBackground(
  mailer: Mailer,
  to: string,
  message: RenderedEmail,
  context: string,
): void {
  mailer
    .send(to, message)
    .then((result) => {
      if (!result.ok) {
        console.error(`[email] ${context} to ${to} FAILED: ${result.error}`);
      } else if (!result.skipped) {
        console.log(`[email] ${context} sent to ${to} (${result.id ?? 'no id'})`);
      }
    })
    .catch((err) => {
      console.error(`[email] ${context} to ${to} threw:`, err);
    });
}

/** Non-secret view for the admin dashboard. */
export function describeMailer(mailer: Mailer): {
  driver: string;
  configured: boolean;
  from: string;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (!mailer.configured) {
    warnings.push(
      'No RESEND_API_KEY set — emails are logged to the server console, not delivered. Applicants will not receive their reference or payment link.',
    );
  }
  if (process.env.EMAIL_REDIRECT_TO) {
    warnings.push(
      `EMAIL_REDIRECT_TO is set: every email is being redirected to ${process.env.EMAIL_REDIRECT_TO} instead of the real recipient. Unset this in production.`,
    );
  }

  return {
    driver: mailer.driver,
    configured: mailer.configured,
    from: mailer.from,
    warnings,
  };
}
