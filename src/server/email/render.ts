/**
 * Email templates.
 *
 * Every message is built here as a matched HTML + plain-text pair. Plain text
 * is not an afterthought: some clients and most spam filters read it, and a
 * missing text part measurably hurts deliverability.
 *
 * The visual language follows the poster — black ground, gold accent — but
 * with table-based layout and inline styles, because email clients ignore
 * external stylesheets, most of flexbox, and roughly all of modern CSS.
 */

import { EVENT } from '../../config/event.js';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const GOLD = '#C5A059';
const INK = '#0A0A0A';
const SURFACE = '#141414';
const BONE = '#FFFFFF';
const MUTED = '#A1A1AA';

/** Escapes text interpolated into the HTML part. Applicant names are user input. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(amount: number): string {
  const fixed = amount.toFixed(2);
  const [whole, fraction] = fixed.split('.');
  return `R${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${fraction}`;
}

interface ShellOptions {
  preheader: string;
  heading: string;
  body: string;
  /** Optional single call to action. */
  cta?: { label: string; url: string };
  /** Optional highlighted reference panel. */
  panel?: { label: string; value: string; note?: string };
}

function shell({ preheader, heading, body, cta, panel }: ShellOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${INK};">
<!-- Preheader: shown in the inbox preview, hidden in the body. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${INK};">
<tr><td align="center" style="padding:40px 16px;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${SURFACE};border:1px solid rgba(197,160,89,0.25);">

    <tr><td style="padding:36px 36px 0;text-align:center;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:13px;letter-spacing:4px;text-transform:uppercase;color:${GOLD};font-weight:bold;">
        Silver Crest Connect
      </div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${MUTED};padding-top:8px;">
        ${esc(EVENT.tagline)}
      </div>
      <div style="height:1px;background:${GOLD};opacity:0.3;margin:28px 0 0;"></div>
    </td></tr>

    <tr><td style="padding:32px 36px 0;">
      <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:${BONE};font-weight:normal;">
        ${esc(heading)}
      </h1>
    </td></tr>

    <tr><td style="padding:20px 36px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:${MUTED};">
      ${body}
    </td></tr>

    ${
      panel
        ? `<tr><td style="padding:28px 36px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(197,160,89,0.08);border:1px solid rgba(197,160,89,0.3);">
        <tr><td style="padding:20px;text-align:center;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};font-weight:bold;">${esc(panel.label)}</div>
          <div style="font-family:'Courier New',Courier,monospace;font-size:22px;letter-spacing:3px;color:${BONE};padding-top:10px;">${esc(panel.value)}</div>
          ${panel.note ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};padding-top:10px;">${esc(panel.note)}</div>` : ''}
        </td></tr>
      </table>
    </td></tr>`
        : ''
    }

    ${
      cta
        ? `<tr><td style="padding:28px 36px 0;" align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="background:${GOLD};">
          <a href="${esc(cta.url)}" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#000000;text-decoration:none;">${esc(cta.label)}</a>
        </td></tr>
      </table>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${MUTED};padding-top:14px;word-break:break-all;">
        Or paste this into your browser:<br>${esc(cta.url)}
      </div>
    </td></tr>`
        : ''
    }

    <tr><td style="padding:32px 36px 36px;">
      <div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:20px;"></div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:#6B6B72;">
        <strong style="color:${MUTED};">${esc(EVENT.dateLabel)}</strong> &middot; ${esc(EVENT.timeLabel)} &middot; ${esc(EVENT.venueCity)}<br>
        Presented by ${esc(EVENT.presentedBy)}<br>
        <a href="mailto:${esc(EVENT.contactEmail)}" style="color:${GOLD};text-decoration:none;">${esc(EVENT.contactEmail)}</a>
      </div>
    </td></tr>

  </table>

  <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#5A5A60;padding-top:20px;">
    100% of proceeds fund the ${esc(EVENT.causeShort)}.
  </div>

</td></tr>
</table>
</body>
</html>`;
}

/** Shared footer for every plain-text part. */
function textFooter(): string {
  return `
---
${EVENT.fullName}
${EVENT.dateLabel} - ${EVENT.timeLabel} - ${EVENT.venueCity}
Presented by ${EVENT.presentedBy}
${EVENT.contactEmail}

100% of proceeds fund the ${EVENT.causeShort}.`;
}

// ------------------------------------------------------------------ templates

/** Sent immediately on application. Sets the expectation that vetting comes next. */
export function applicationReceived(input: {
  contactName: string;
  businessName: string;
  reference: string;
  attendeeCount?: 1 | 2;
}): RenderedEmail {
  const { contactName, businessName, reference, attendeeCount = 1 } = input;

  return {
    subject: `Thank you for applying — ${EVENT.fullName}`,
    html: shell({
      preheader: `We have received your application for ${businessName}. Reference: ${reference}.`,
      heading: 'Application Received',
      body: `<p style="margin:0 0 16px;">Hi ${esc(contactName)},</p>
<p style="margin:0 0 16px;">Thank you for applying to attend <strong style="color:${BONE};">${esc(EVENT.fullName)}</strong> on ${esc(EVENT.dateLabel)} for <strong style="color:${BONE};">${esc(businessName)}</strong> (${attendeeCount} ${attendeeCount === 1 ? 'attendee' : 'attendees'}).</p>
<p style="margin:0 0 16px;">Because Connect is a curated event aiming for <strong>1–2 businesses per category</strong>, applications are reviewed to maintain a diverse, high-value mix of non-competing businesses and professionals.</p>
<p style="margin:0 0 16px;">Our team is reviewing your application. If approved, you will receive an email with your private payment instructions to secure your spot.</p>
<p style="margin:0;">There is no payment required at this stage.</p>`,
      panel: {
        label: 'Your Reference Number',
        value: reference,
        note: 'Keep this reference handy — you will need it once approved.',
      },
    }),
    text: `Hi ${contactName},

Thank you for applying to attend ${EVENT.fullName} on ${EVENT.dateLabel} for ${businessName} (${attendeeCount} ${attendeeCount === 1 ? 'attendee' : 'attendees'}).

Because Connect is a curated event aiming for 1-2 businesses per category, applications are reviewed to maintain a diverse, high-value mix of non-competing businesses and professionals.

Our team is reviewing your application. If approved, you will receive an email with your private payment instructions to secure your spot.

There is no payment required at this stage.

YOUR REFERENCE: ${reference}
Keep this reference handy - you will need it once approved.
${textFooter()}`,
  };
}

/** Sent when the team approves an application. Carries the payment link. */
export function applicationApproved(input: {
  contactName: string;
  businessName: string;
  reference: string;
  payUrl: string;
  seatsRemaining: number;
  attendeeCount?: 1 | 2;
  totalAmountZAR?: number;
}): RenderedEmail {
  const {
    contactName,
    businessName,
    reference,
    payUrl,
    seatsRemaining,
    attendeeCount = 1,
    totalAmountZAR = attendeeCount === 2 ? EVENT.ticketPriceZAR * 2 : EVENT.ticketPriceZAR,
  } = input;

  const scarcity =
    seatsRemaining > 0 && seatsRemaining <= 5
      ? `<p style="margin:0 0 16px;color:${GOLD};">Only ${seatsRemaining} ${seatsRemaining === 1 ? 'seat' : 'seats'} remaining.</p>`
      : '';

  return {
    subject: `Your application is approved — Secure your seat for ${EVENT.fullName}`,
    html: shell({
      preheader: `${businessName} is approved! Complete payment of ${money(totalAmountZAR)} to secure your seat.`,
      heading: 'Application Approved',
      body: `<p style="margin:0 0 16px;">Hi ${esc(contactName)},</p>
<p style="margin:0 0 16px;">Good news — your application for <strong style="color:${BONE};">${esc(businessName)}</strong> has been approved for <strong style="color:${BONE};">${esc(EVENT.fullName)}</strong> on ${esc(EVENT.dateLabel)}.</p>
<p style="margin:0 0 16px;">Your seat is now available to secure. Total attendance fee: <strong style="color:${BONE};">${money(totalAmountZAR)}</strong> for ${attendeeCount} ${attendeeCount === 1 ? 'attendee' : 'attendees'} (includes light breakfast, morning refreshments, and full event access).</p>
<p style="margin:0 0 16px;">Click below to complete your payment securely via PayFast.</p>
${scarcity}
<p style="margin:0;font-weight:bold;color:${GOLD};">Important: Your seat is only confirmed once payment has cleared.</p>`,
      cta: { label: `Pay ${money(totalAmountZAR)} & Confirm Seat`, url: payUrl },
      panel: { label: 'Your Reference', value: reference },
    }),
    text: `Hi ${contactName},

Good news - your application for ${businessName} has been approved for ${EVENT.fullName} on ${EVENT.dateLabel}.

Your seat is now available to secure. Total attendance fee: ${money(totalAmountZAR)} for ${attendeeCount} ${attendeeCount === 1 ? 'attendee' : 'attendees'} (includes light breakfast, morning refreshments, and full event access).

Complete your payment securely via PayFast here:

${payUrl}

${seatsRemaining > 0 && seatsRemaining <= 5 ? `Only ${seatsRemaining} ${seatsRemaining === 1 ? 'seat' : 'seats'} remaining.\n\n` : ''}Important: Your seat is only confirmed once payment has cleared.

YOUR REFERENCE: ${reference}
${textFooter()}`,
  };
}

/** Sent when a ticket payment clears. This is the actual ticket. */
export function ticketConfirmed(input: {
  contactName: string;
  businessName: string;
  ticketCode: string;
  amountZAR: number;
  attendeeCount?: 1 | 2;
}): RenderedEmail {
  const { contactName, businessName, ticketCode, amountZAR, attendeeCount = 1 } = input;

  return {
    subject: `YOU'RE CONFIRMED — SILVER CREST CONNECT '26`,
    html: shell({
      preheader: `You're confirmed for Silver Crest Connect '26! Ticket code: ${ticketCode}.`,
      heading: "YOU'RE CONFIRMED",
      body: `<p style="margin:0 0 16px;">Hi ${esc(contactName)},</p>
<p style="margin:0 0 16px;">Payment of <strong style="color:${BONE};">${money(amountZAR)}</strong> received. <strong style="color:${BONE};">${esc(businessName)}</strong> is officially confirmed for <strong style="color:${BONE};">${esc(EVENT.fullName)}</strong> (${attendeeCount} ${attendeeCount === 1 ? 'attendee' : 'attendees'}).</p>
<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);padding:16px;margin:20px 0;border-radius:4px;">
  <p style="margin:0 0 8px;font-size:14px;color:${BONE};"><strong>Date:</strong> Friday, ${esc(EVENT.dateLabel)}</p>
  <p style="margin:0 0 8px;font-size:14px;color:${BONE};"><strong>Time:</strong> ${esc(EVENT.timeLabel)} (Registration from 08:30)</p>
  <p style="margin:0 0 8px;font-size:14px;color:${BONE};"><strong>Location:</strong> ${esc(EVENT.venueCity)}</p>
  <p style="margin:0;font-size:14px;color:${GOLD};"><strong>Includes:</strong> Light breakfast, refreshments, and welcome pack</p>
</div>
<p style="margin:0 0 16px;"><strong>What to expect:</strong> On arrival, you will receive your custom lanyard, business badge, and executive pen. You will also have the floor during the SME Spotlight to introduce your business to the room.</p>
<p style="margin:0;">100% of proceeds go directly towards supplies for the ${esc(EVENT.causeShort)}. We look forward to hosting you.</p>`,
      panel: {
        label: 'Your Digital Ticket Code',
        value: ticketCode,
        note: 'Present this ticket code upon arrival at registration.',
      },
    }),
    text: `Hi ${contactName},

Payment of ${money(amountZAR)} received. ${businessName} is officially confirmed for ${EVENT.fullName} (${attendeeCount} ${attendeeCount === 1 ? 'attendee' : 'attendees'}).

EVENT DETAILS:
- Date: Friday, ${EVENT.dateLabel}
- Time: ${EVENT.timeLabel} (Registration opens 08:30)
- Location: ${EVENT.venueCity}
- Includes: Light breakfast, morning refreshments, and welcome pack

WHAT TO EXPECT:
On arrival, you will receive your custom lanyard, business badge, and executive pen. You will also have the floor during the SME Spotlight to introduce your business to the room.

YOUR TICKET CODE: ${ticketCode}
Present this code upon arrival at registration.

100% of proceeds fund the ${EVENT.causeShort}. We look forward to hosting you!
${textFooter()}`,
  };
}

/** Sent when a donation clears. Doubles as the receipt. */
export function donationReceipt(input: {
  name: string;
  amountZAR: number;
  reference: string;
}): RenderedEmail {
  const { name, amountZAR, reference } = input;

  return {
    subject: `Thank you for your donation — ${money(amountZAR)}`,
    html: shell({
      preheader: `Your ${money(amountZAR)} donation to the ${EVENT.causeShort} has been received.`,
      heading: 'Thank you',
      body: `<p style="margin:0 0 16px;">Hi ${esc(name)},</p>
<p style="margin:0 0 16px;">Your donation of <strong style="color:${BONE};">${money(amountZAR)}</strong> has been received, and goes directly towards supplies for the ${esc(EVENT.cause)}.</p>
<p style="margin:0 0 16px;">Nothing is held back for event overheads. Every rand reaches the drive.</p>
<p style="margin:0;">This email is your receipt.</p>`,
      panel: {
        label: 'Receipt reference',
        value: reference,
        note: `${money(amountZAR)} received`,
      },
    }),
    text: `Hi ${name},

Your donation of ${money(amountZAR)} has been received, and goes directly
towards supplies for the ${EVENT.cause}.

Nothing is held back for event overheads. Every rand reaches the drive.

This email is your receipt.

RECEIPT REFERENCE: ${reference}
${money(amountZAR)} received
${textFooter()}`,
  };
}

/** Sent manually from the admin dashboard to paid attendees with the latest programme agenda. */
export function programmeBroadcastEmail(input: {
  contactName: string;
  businessName: string;
  dateLabel: string;
  venueCity: string;
  customMessage?: string;
  programme: Array<{ time: string; duration: string; title: string; detail: string }>;
}): RenderedEmail {
  const { contactName, businessName, dateLabel, venueCity, customMessage, programme } = input;

  const agendaHtml = programme
    .map(
      (p) => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
      <td style="padding:10px 0;font-family:monospace;font-size:12px;color:${GOLD};width:130px;vertical-align:top;">${esc(p.time)}</td>
      <td style="padding:10px 0;vertical-align:top;">
        <div style="font-weight:bold;color:${BONE};font-size:13px;">${esc(p.title)}</div>
        <div style="color:${MUTED};font-size:12px;margin-top:2px;">${esc(p.detail)}</div>
      </td>
    </tr>`,
    )
    .join('');

  const agendaText = programme
    .map((p) => `${p.time} (${p.duration}) - ${p.title}\n  ${p.detail}`)
    .join('\n\n');

  return {
    subject: `Event Programme & Schedule Update — ${EVENT.fullName}`,
    html: shell({
      preheader: `The official event programme for ${EVENT.fullName} on ${dateLabel}.`,
      heading: 'Event Programme',
      body: `<p style="margin:0 0 16px;">Hi ${esc(contactName)},</p>
<p style="margin:0 0 16px;">Here is the latest schedule for <strong>${esc(businessName)}</strong> for <strong>${esc(EVENT.fullName)}</strong> on <strong>${esc(dateLabel)}</strong> in ${esc(venueCity)}.</p>
${customMessage ? `<p style="margin:0 0 16px;color:${GOLD};">${esc(customMessage)}</p>` : ''}
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
  ${agendaHtml}
</table>
<p style="margin:16px 0 0;font-size:12px;color:${MUTED};">We look forward to hosting you!</p>`,
    }),
    text: `Hi ${contactName},

Here is the latest schedule for ${businessName} for ${EVENT.fullName} on ${dateLabel} in ${venueCity}.

${customMessage ? `${customMessage}\n\n` : ''}PROGRAMME:
${agendaText}

We look forward to hosting you!
${textFooter()}`,
  };
}

