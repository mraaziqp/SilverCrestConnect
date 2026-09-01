/**
 * Outbound email.
 *
 * Three drivers behind one interface:
 *   - smtp     real delivery through an SMTP server (Microsoft 365, Google
 *              Workspace, or any host's mail server)
 *   - resend   real delivery via the Resend HTTP API
 *   - console  logs the message instead of sending it
 *
 * The driver is chosen from what is configured — SMTP_HOST wins, then
 * RESEND_API_KEY, otherwise console. Nothing in the app has to know which is
 * active, and the console driver means the whole funnel works end to end on a
 * laptop without anyone receiving mail.
 *
 * Sending never blocks or fails a request. If a receipt cannot be delivered
 * that is worth a loud log line, but it must not roll back a payment that
 * PayFast has already taken.
 */

import nodemailer, { type Transporter } from 'nodemailer';

import { EVENT } from '../../config/event.js';
import type { RenderedEmail } from './render.js';

export type MailDriver = 'smtp' | 'resend' | 'console';

export interface Mailer {
  readonly driver: MailDriver;
  readonly configured: boolean;
  readonly from: string;
  send(to: string, message: RenderedEmail): Promise<SendResult>;
  /** Opens a connection and authenticates without sending. SMTP only. */
  verify?(): Promise<{ ok: boolean; error?: string }>;
  /** Releases pooled connections. SMTP only. */
  close?(): void;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
  /** True when the message was logged rather than delivered. */
  skipped?: boolean;
}

export interface SmtpSettings {
  host: string;
  port: number;
  /** True for implicit TLS (port 465). False for STARTTLS (port 587). */
  secure: boolean;
  user: string;
  pass: string;
  /**
   * Refuse to send unless the connection is encrypted. On by default and
   * should stay on for anything crossing a network — only an internal relay
   * on localhost has any business turning it off.
   */
  requireTls: boolean;
}

export interface MailerConfig {
  smtp?: SmtpSettings;
  resendApiKey: string;
  /** e.g. "Silver Crest Connect <connect@scconnect.co.za>" */
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

  const host = (env.SMTP_HOST || '').trim();
  const port = Number(env.SMTP_PORT) || 587;

  return {
    smtp: host
      ? {
          host,
          port,
          // Port 465 is implicit TLS; 587 upgrades via STARTTLS. Honour an
          // explicit override, otherwise infer from the port.
          secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465,
          user: (env.SMTP_USER || '').trim(),
          pass: env.SMTP_PASS || '',
          requireTls: env.SMTP_REQUIRE_TLS !== 'false',
        }
      : undefined,
    resendApiKey: (env.RESEND_API_KEY || '').trim(),
    // A bare address works, but a display name renders far better in an inbox.
    from: fromAddress.includes('<') ? fromAddress : `${fromName} <${fromAddress}>`,
    replyTo: (env.EMAIL_REPLY_TO || EVENT.contactEmail).trim(),
    redirectTo: (env.EMAIL_REDIRECT_TO || '').trim(),
  };
}

export function createMailer(config: MailerConfig): Mailer {
  if (config.smtp?.host) return new SmtpMailer(config, config.smtp);
  if (config.resendApiKey) return new ResendMailer(config);
  return new ConsoleMailer(config);
}

/**
 * Delivers through an SMTP server.
 *
 * Microsoft 365 notes, since that is what this deployment uses:
 *   - host smtp.office365.com, port 587, STARTTLS
 *   - SMTP AUTH must be enabled on the mailbox; it is OFF by default on new
 *     tenants (Microsoft 365 admin -> Users -> Mail -> Manage email apps)
 *   - the From address must be the authenticated mailbox, or an alias it holds
 *     "Send As" rights on, or the server rejects with 5.7.60
 */
class SmtpMailer implements Mailer {
  readonly driver = 'smtp' as const;
  readonly configured = true;
  private transporter: Transporter;

  constructor(
    private readonly config: MailerConfig,
    smtp: SmtpSettings,
  ) {
    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
      // Reuse one connection across a burst rather than reconnecting per
      // message; Microsoft 365 throttles aggressive reconnects.
      pool: true,
      maxConnections: 2,
      // Microsoft 365 caps at roughly 30 messages a minute.
      rateDelta: 60_000,
      rateLimit: 25,
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      requireTLS: smtp.requireTls && !smtp.secure,
      ignoreTLS: !smtp.requireTls && !smtp.secure,
      tls: { minVersion: 'TLSv1.2' },
    });
  }

  get from(): string {
    return this.config.from;
  }

  /** Used at startup so a bad password surfaces immediately, not on first send. */
  async verify(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.transporter.verify();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: explainSmtpError(err as NodeJS.ErrnoException) };
    }
  }

  close(): void {
    this.transporter.close();
  }

  async send(to: string, message: RenderedEmail): Promise<SendResult> {
    const recipient = this.config.redirectTo || to;

    try {
      const info = await this.transporter.sendMail({
        from: this.config.from,
        to: recipient,
        replyTo: this.config.replyTo,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return { ok: true, id: info.messageId };
    } catch (err) {
      return { ok: false, error: explainSmtpError(err as NodeJS.ErrnoException) };
    }
  }
}

/**
 * SMTP failures are famously cryptic. Translate the handful that actually
 * happen into something that says what to change.
 */
function explainSmtpError(err: NodeJS.ErrnoException & { responseCode?: number }): string {
  const raw = err?.message ?? String(err);

  if (raw.includes('5.7.60') || raw.includes('Client does not have permissions to send as')) {
    return `${raw} — the From address must be the authenticated mailbox, or an alias it has "Send As" rights on. Set EMAIL_FROM to the SMTP_USER address, or grant the alias Send As permission in Microsoft 365.`;
  }
  if (raw.includes('5.7.57') || raw.includes('must issue a STARTTLS')) {
    return `${raw} — the connection was not authenticated. Check SMTP_USER and SMTP_PASS, and that SMTP AUTH is enabled for the mailbox.`;
  }
  if (err?.responseCode === 535 || raw.includes('535')) {
    return `${raw} — authentication was rejected. On Microsoft 365 this usually means SMTP AUTH is disabled for the mailbox, or the account has MFA and needs an app password rather than the normal password.`;
  }
  // nodemailer wraps socket failures, so the original code often lands in the
  // message rather than on err.code. Check both.
  if (/ENOTFOUND|EAI_AGAIN/.test(raw) || err?.code === 'ENOTFOUND') {
    return `${raw} — the SMTP hostname could not be resolved. Check SMTP_HOST for a typo (Microsoft 365 is smtp.office365.com).`;
  }
  if (
    /ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ECONNRESET/.test(raw) ||
    err?.code === 'ETIMEDOUT' ||
    err?.code === 'ECONNREFUSED' ||
    err?.code === 'ESOCKET'
  ) {
    return `${raw} — could not reach the SMTP server. Check SMTP_HOST and SMTP_PORT, and that outbound port 587 is not blocked from this host.`;
  }
  if (raw.includes('4.7.') || raw.includes('throttl')) {
    return `${raw} — the server is rate limiting. Microsoft 365 allows roughly 30 messages a minute and 10,000 recipients a day.`;
  }
  return raw;
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
          Authorization: `Bearer ${this.config.resendApiKey}`,
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
        // Resend describes the problem in the body; surface it, since the
        // usual cause is an unverified sender domain and that is fixable.
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

/** Logs instead of sending. Used until a real driver is configured. */
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
        '┌─ EMAIL (not sent — no mail driver configured) ─────────────────',
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
 * because a mail server was briefly down.
 */
/**
 * The last delivery failure, kept so /admin can show it.
 *
 * A send that fails only writes to the log, and nobody reads a serverless log.
 * The applicant simply never receives their reference or payment link, and the
 * first anyone hears of it is someone asking why they were never contacted.
 * Holding the last failure lets the dashboard say so out loud.
 */
let lastFailure: { at: string; context: string; error: string } | null = null;

export function getLastMailFailure(): { at: string; context: string; error: string } | null {
  return lastFailure;
}

/** Cleared once something gets through, so a fixed problem stops being reported. */
export function clearLastMailFailure(): void {
  lastFailure = null;
}

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
        lastFailure = { at: new Date().toISOString(), context, error: result.error ?? 'unknown' };
        console.error(`[email] ${context} to ${to} FAILED: ${result.error}`);
      } else if (!result.skipped) {
        lastFailure = null;
        console.log(`[email] ${context} sent to ${to} (${result.id ?? 'no id'})`);
      }
    })
    .catch((err) => {
      console.error(`[email] ${context} to ${to} threw:`, err);
    });
}

/** Extracts the bare address from "Name <a@b.com>". */
export function bareAddress(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match ? match[1] : value).trim().toLowerCase();
}

/** Non-secret view for the admin dashboard. Never exposes the password. */
export function describeMailer(
  mailer: Mailer,
  config?: MailerConfig,
): {
  driver: string;
  configured: boolean;
  from: string;
  host?: string;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (!mailer.configured) {
    warnings.push(
      'No mail driver configured — emails are logged to the server console, not delivered. Applicants will not receive their reference or payment link.',
    );
  }

  const failure = getLastMailFailure();
  if (failure) {
    const unverified = /not verified|domain is not/i.test(failure.error);
    warnings.push(
      unverified
        ? `EMAIL IS NOT BEING DELIVERED. The sending domain in EMAIL_FROM is not verified with the mail provider, so every message is refused. Verify the domain, or send from one that is. (Last failure: ${failure.context}.)`
        : `The last email failed to send (${failure.context}): ${failure.error}`,
    );
  }

  if (mailer.driver === 'smtp' && config?.smtp) {
    if (!config.smtp.user || !config.smtp.pass) {
      warnings.push('SMTP_HOST is set but SMTP_USER or SMTP_PASS is missing — authentication will fail.');
    }
    // The single most common Microsoft 365 rejection: sending as an address
    // the authenticated mailbox does not own.
    if (!config.smtp.requireTls && !config.smtp.secure) {
      warnings.push('SMTP_REQUIRE_TLS is off — mail is being sent over an unencrypted connection. Turn this on unless the relay is on localhost.');
    }
    if (config.smtp.user && bareAddress(config.from) !== bareAddress(config.smtp.user)) {
      warnings.push(
        `EMAIL_FROM (${bareAddress(config.from)}) differs from SMTP_USER (${bareAddress(config.smtp.user)}). Most SMTP servers, Microsoft 365 included, reject this unless the alias has "Send As" permission.`,
      );
    }
  }

  if (config?.redirectTo) {
    warnings.push(
      `EMAIL_REDIRECT_TO is set: every email is being redirected to ${config.redirectTo} instead of the real recipient. Unset this in production.`,
    );
  }

  return {
    driver: mailer.driver,
    configured: mailer.configured,
    from: mailer.from,
    host: config?.smtp?.host,
    warnings,
  };
}
