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

/* ── Brand palette ─────────────────────────────────────────────── */
const GOLD = '#C5A059';
const GOLD_LIGHT = '#D4B577';
const GOLD_DARK = '#A88940';
const INK = '#0A0A0A';
const SURFACE = '#111111';
const CARD = '#161616';
const BONE = '#F5F0E8';
const WHITE = '#FFFFFF';
const MUTED = '#9A9A9F';
const DIVIDER = 'rgba(197,160,89,0.20)';
const DIVIDER_SUBTLE = 'rgba(255,255,255,0.06)';
const GOLD_BG = 'rgba(197,160,89,0.06)';
const GOLD_BORDER = 'rgba(197,160,89,0.30)';

/** Logo URL — served from the public site. Falls back gracefully if blocked. */
const LOGO_URL = `${EVENT.website}/logo.png`;

/** Escapes text interpolated into the HTML part. Applicant names are user input. */
function esc(value?: string | null): string {
  if (value === undefined || value === null) return '';
  return String(value)
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

/* ── Shell ─────────────────────────────────────────────────────── */

interface ShellOptions {
  preheader: string;
  heading: string;
  /** Optional single-line subheading beneath the heading. */
  subheading?: string;
  body: string;
  /** Optional single call to action. */
  cta?: { label: string; url: string };
  /** Optional highlighted reference / ticket panel. */
  panel?: { label: string; value: string; note?: string };
  /** Optional event details card (for ticket confirmations). */
  eventCard?: boolean;
}

function shell({ preheader, heading, subheading, body, cta, panel, eventCard }: ShellOptions): string {
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${esc(heading)}</title>
<!--[if mso]>
<style>table{border-collapse:collapse;}td{font-family:Arial,Helvetica,sans-serif;}</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background:${INK};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<!-- Preheader: shown in the inbox preview, hidden in the body. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${INK};">${esc(preheader)}${'&nbsp;&zwnj;'.repeat(30)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${INK};min-height:100%;">
<tr><td align="center" style="padding:32px 16px 48px;">

  <!-- ═══ Outer card ═══ -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;border-radius:8px;overflow:hidden;">

    <!-- ── Top gold accent line ── -->
    <tr><td style="height:3px;background:linear-gradient(90deg,${GOLD_DARK},${GOLD},${GOLD_LIGHT},${GOLD},${GOLD_DARK});font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- ── Header with logo ── -->
    <tr><td style="background:${SURFACE};padding:36px 40px 28px;text-align:center;">

      <!-- Logo -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
        <tr><td style="text-align:center;">
          <a href="${esc(EVENT.website)}" style="text-decoration:none;" target="_blank">
            <img src="${esc(LOGO_URL)}" width="56" height="50" alt="Silver Crest" style="display:block;margin:0 auto;border:0;outline:none;" />
          </a>
        </td></tr>
      </table>

      <!-- Brand name -->
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;letter-spacing:5px;text-transform:uppercase;color:${GOLD};font-weight:bold;padding-top:16px;">
        Silver Crest Connect
      </div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:${MUTED};padding-top:6px;">
        ${esc(EVENT.tagline)}
      </div>

    </td></tr>

    <!-- ── Gold divider ── -->
    <tr><td style="background:${SURFACE};padding:0 40px;">
      <div style="height:1px;background:${DIVIDER};"></div>
    </td></tr>

    <!-- ── Heading ── -->
    <tr><td style="background:${SURFACE};padding:28px 40px 0;">
      <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:${WHITE};font-weight:normal;letter-spacing:0.5px;">
        ${esc(heading)}
      </h1>
      ${subheading ? `<p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};line-height:1.5;">${esc(subheading)}</p>` : ''}
    </td></tr>

    <!-- ── Body ── -->
    <tr><td style="background:${SURFACE};padding:22px 40px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${MUTED};">
      ${body}
    </td></tr>

    ${panel ? renderPanel(panel) : ''}

    ${eventCard ? renderEventCard() : ''}

    ${cta ? renderCta(cta) : ''}

    <!-- ── Footer ── -->
    <tr><td style="background:${SURFACE};padding:32px 40px 36px;">
      <div style="height:1px;background:${DIVIDER_SUBTLE};margin-bottom:24px;"></div>

      <!-- Event details row -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.8;color:#6B6B72;">
            <span style="color:${BONE};font-weight:bold;">${esc(EVENT.dateLabel)}</span><br>
            ${esc(EVENT.timeLabel)} &middot; ${esc(EVENT.venueCity)}<br>
            ${EVENT.presentedBy ? `Presented by ${esc(EVENT.presentedBy)}<br>` : ''}
            <a href="mailto:${esc(EVENT.contactEmail)}" style="color:${GOLD};text-decoration:none;">${esc(EVENT.contactEmail)}</a>
          </td>
        </tr>
      </table>

      <!-- Cause note -->
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#5A5A60;padding-top:16px;line-height:1.6;">
        100% of every donation funds the ${esc(EVENT.causeShort)}.
      </div>

      <!-- Copyright -->
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#44444A;padding-top:12px;letter-spacing:0.5px;">
        &copy; ${year} ${esc(EVENT.copyrightText)}
      </div>
    </td></tr>

    <!-- ── Bottom gold accent line ── -->
    <tr><td style="height:2px;background:linear-gradient(90deg,${GOLD_DARK},${GOLD},${GOLD_LIGHT},${GOLD},${GOLD_DARK});font-size:0;line-height:0;">&nbsp;</td></tr>

  </table>

</td></tr>
</table>
</body>
</html>`;
}

/* ── Panel (reference / ticket code) ──────────────────────────── */

function renderPanel(panel: { label: string; value: string; note?: string }): string {
  return `
    <tr><td style="background:${SURFACE};padding:28px 40px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${GOLD_BG};border:1px solid ${GOLD_BORDER};border-radius:6px;overflow:hidden;">
        <!-- Ticket-stub top edge -->
        <tr><td style="height:4px;background:${GOLD};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:22px 24px;text-align:center;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${GOLD};font-weight:bold;">
            ${esc(panel.label)}
          </div>
          <div style="font-family:'Courier New',Courier,monospace;font-size:26px;letter-spacing:4px;color:${WHITE};padding-top:12px;font-weight:bold;">
            ${esc(panel.value)}
          </div>
          ${panel.note ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};padding-top:12px;line-height:1.5;">${esc(panel.note)}</div>` : ''}
        </td></tr>
      </table>
    </td></tr>`;
}

/* ── CTA button ───────────────────────────────────────────────── */

function renderCta(cta: { label: string; url: string }): string {
  return `
    <tr><td style="background:${SURFACE};padding:28px 40px 0;" align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="background:${GOLD};border-radius:4px;">
          <a href="${esc(cta.url)}" style="display:inline-block;padding:16px 36px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:2.5px;text-transform:uppercase;color:#000000;text-decoration:none;line-height:1;" target="_blank">
            ${esc(cta.label)}
          </a>
        </td></tr>
      </table>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#5A5A60;padding-top:14px;word-break:break-all;line-height:1.5;">
        Or paste this into your browser:<br>
        <a href="${esc(cta.url)}" style="color:${GOLD_LIGHT};text-decoration:none;">${esc(cta.url)}</a>
      </div>
    </td></tr>`;
}

/* ── Event details card (for ticket confirmations) ────────────── */

function renderEventCard(): string {
  return `
    <tr><td style="background:${SURFACE};padding:24px 40px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CARD};border:1px solid ${DIVIDER_SUBTLE};border-radius:6px;overflow:hidden;">
        <tr><td style="padding:20px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};width:90px;vertical-align:top;">
                <strong style="color:${GOLD};">Date</strong>
              </td>
              <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BONE};">
                Friday, ${esc(EVENT.dateLabel)}
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};vertical-align:top;">
                <strong style="color:${GOLD};">Time</strong>
              </td>
              <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BONE};">
                ${esc(EVENT.timeLabel)} (Registration from 08:30)
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};vertical-align:top;">
                <strong style="color:${GOLD};">Location</strong>
              </td>
              <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BONE};">
                ${esc(EVENT.venueCity)}
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};vertical-align:top;">
                <strong style="color:${GOLD};">Includes</strong>
              </td>
              <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${GOLD_LIGHT};">
                Light breakfast, refreshments &amp; welcome pack
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td></tr>`;
}

/* ── Shared footer for every plain-text part ──────────────────── */

function textFooter(): string {
  return `
---
${EVENT.fullName}
${EVENT.dateLabel} - ${EVENT.timeLabel} - ${EVENT.venueCity}${EVENT.presentedBy ? `\nPresented by ${EVENT.presentedBy}` : ''}
${EVENT.contactEmail}

100% of every donation funds the ${EVENT.causeShort}.`;
}

// ================================================================== templates

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
      subheading: `${EVENT.fullName} · ${EVENT.dateLabel}`,
      body: `<p style="margin:0 0 16px;">Hi ${esc(contactName)},</p>
<p style="margin:0 0 16px;">Thank you for applying to attend <strong style="color:${WHITE};">${esc(EVENT.fullName)}</strong> on ${esc(EVENT.dateLabel)} for <strong style="color:${WHITE};">${esc(businessName)}</strong> (${attendeeCount} ${attendeeCount === 1 ? 'attendee' : 'attendees'}).</p>
<p style="margin:0 0 16px;">Because Connect is a curated event aiming for <strong>1–2 businesses per category</strong>, applications are reviewed to maintain a diverse, high-value mix of non-competing businesses and professionals.</p>
<p style="margin:0 0 16px;">Our team is reviewing your application. If approved, you will receive an email with your private payment instructions to secure your spot.</p>
<p style="margin:0;color:${GOLD};">There is no payment required at this stage.</p>`,
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
  /** False while the site is collecting applications but cannot take money. */
  paymentsOpen?: boolean;
}): RenderedEmail {
  const {
    contactName,
    businessName,
    reference,
    payUrl,
    seatsRemaining,
    attendeeCount = 1,
    totalAmountZAR = attendeeCount === 2 ? EVENT.ticketPriceZAR * 2 : EVENT.ticketPriceZAR,
    paymentsOpen = true,
  } = input;

  const scarcity =
    seatsRemaining > 0 && seatsRemaining <= 5
      ? `<p style="margin:0 0 16px;color:${GOLD};font-weight:bold;">Only ${seatsRemaining} ${seatsRemaining === 1 ? 'seat' : 'seats'} remaining.</p>`
      : '';

  return {
    subject: paymentsOpen
      ? `Your application is approved — Secure your seat for ${EVENT.fullName}`
      : `Your application is approved — ${EVENT.fullName}`,
    html: shell({
      preheader: paymentsOpen
        ? `${businessName} is approved! Complete payment of ${money(totalAmountZAR)} to secure your seat.`
        : `${businessName} is approved. We will send your payment link shortly.`,
      heading: 'Application Approved',
      subheading: `${esc(businessName)} · ${attendeeCount} ${attendeeCount === 1 ? 'attendee' : 'attendees'}`,
      body: `<p style="margin:0 0 16px;">Hi ${esc(contactName)},</p>
<p style="margin:0 0 16px;">Good news — your application for <strong style="color:${WHITE};">${esc(businessName)}</strong> has been approved for <strong style="color:${WHITE};">${esc(EVENT.fullName)}</strong> on ${esc(EVENT.dateLabel)}.</p>
<p style="margin:0 0 16px;">${paymentsOpen ? 'Your seat is now available to secure. ' : ''}Total attendance fee: <strong style="color:${WHITE};">${money(totalAmountZAR)}</strong> for ${attendeeCount} ${attendeeCount === 1 ? 'attendee' : 'attendees'} (includes light breakfast, morning refreshments, and full event access).</p>
${
  paymentsOpen
    ? `<p style="margin:0 0 16px;">Click below to complete your payment securely via PayFast.</p>
${scarcity}
<p style="margin:0;font-weight:bold;color:${GOLD};">Important: Your seat is only confirmed once payment has cleared.</p>`
    : `<p style="margin:0 0 16px;">Payment is not open just yet. We are finalising it now and will email you a secure payment link as soon as it is ready — there is nothing you need to do in the meantime.</p>
${scarcity}
<p style="margin:0;font-weight:bold;color:${GOLD};">Your approval is recorded against the reference below. Your seat is confirmed once payment has cleared.</p>`
}`,
      ...(paymentsOpen
        ? { cta: { label: `Pay ${money(totalAmountZAR)} & Confirm Seat`, url: payUrl } }
        : {}),
      panel: { label: 'Your Reference', value: reference },
    }),
    text: `Hi ${contactName},

Good news - your application for ${businessName} has been approved for ${EVENT.fullName} on ${EVENT.dateLabel}.

${paymentsOpen ? 'Your seat is now available to secure. ' : ''}Total attendance fee: ${money(totalAmountZAR)} for ${attendeeCount} ${attendeeCount === 1 ? 'attendee' : 'attendees'} (includes light breakfast, morning refreshments, and full event access).

${
  paymentsOpen
    ? `Complete your payment securely via PayFast here:

${payUrl}`
    : `Payment is not open just yet. We are finalising it now and will email you
a secure payment link as soon as it is ready. There is nothing you need
to do in the meantime.`
}

${seatsRemaining > 0 && seatsRemaining <= 5 ? `Only ${seatsRemaining} ${seatsRemaining === 1 ? 'seat' : 'seats'} remaining.\n\n` : ''}Important: Your seat is only confirmed once payment has cleared.

YOUR REFERENCE: ${reference}
${textFooter()}`,
  };
}

/**
 * Tells the team an application has arrived.
 *
 * Applications land in /admin, but nobody watches a dashboard all day, and a
 * curated funnel only works if someone reviews in good time — the applicant is
 * waiting on that review before they can pay. This carries enough detail to
 * make the call without opening anything.
 */
export function applicationNotice(input: {
  businessName: string;
  contactName: string;
  applicantRole?: string;
  email: string;
  phone: string;
  industry: string;
  reference: string;
  attendeeCount?: 1 | 2;
  totalPriceZAR?: number;
  about?: string;
  productsServices?: string;
  communityContribution?: string;
  rep2Name?: string;
  rep2Role?: string;
  adminUrl?: string;
}): RenderedEmail {
  const {
    businessName, contactName, applicantRole, email, phone, industry, reference,
    attendeeCount = 1, totalPriceZAR, about, productsServices, communityContribution,
    rep2Name, rep2Role, adminUrl,
  } = input;

  const row = (label: string, value?: string) =>
    value ? `<p style="margin:0 0 8px;font-size:14px;color:${BONE};"><strong>${esc(label)}:</strong> ${esc(value)}</p>` : '';

  const para = (label: string, value?: string) =>
    value ? `<p style="margin:0 0 14px;"><strong style="color:${BONE};">${esc(label)}</strong><br/>${esc(value)}</p>` : '';

  return {
    subject: `New application: ${businessName} (${industry})`,
    html: shell({
      preheader: `${businessName} applied for ${attendeeCount} ${attendeeCount === 1 ? 'seat' : 'seats'}. Reference ${reference}.`,
      heading: 'New Application',
      body: `<p style="margin:0 0 16px;"><strong style="color:${BONE};">${esc(businessName)}</strong> has applied to attend.</p>
<div style="padding:14px 16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);margin:0 0 18px;">
  ${row('Contact', applicantRole ? `${contactName} (${applicantRole})` : contactName)}
  ${row('Email', email)}
  ${row('Phone', phone)}
  ${row('Sector', industry)}
  ${row('Attendees', String(attendeeCount))}
  ${rep2Name ? row('Second representative', rep2Role ? `${rep2Name} (${rep2Role})` : rep2Name) : ''}
  ${totalPriceZAR ? row('Fee if approved', money(totalPriceZAR)) : ''}
</div>
${para('About the business', about)}
${para('Products and services', productsServices)}
${para('Community contribution', communityContribution)}
<p style="margin:0;">They are waiting on a review before they can pay.</p>`,
      cta: adminUrl ? { label: 'Open the dashboard', url: adminUrl } : undefined,
      panel: { label: 'Reference', value: reference },
    }),
    text: `${businessName} has applied to attend.

Contact:   ${applicantRole ? `${contactName} (${applicantRole})` : contactName}
Email:     ${email}
Phone:     ${phone}
Sector:    ${industry}
Attendees: ${attendeeCount}${rep2Name ? `
Second:    ${rep2Role ? `${rep2Name} (${rep2Role})` : rep2Name}` : ''}${totalPriceZAR ? `
Fee:       ${money(totalPriceZAR)}` : ''}

${about ? `ABOUT THE BUSINESS:
${about}

` : ''}${productsServices ? `PRODUCTS AND SERVICES:
${productsServices}

` : ''}${communityContribution ? `COMMUNITY CONTRIBUTION:
${communityContribution}

` : ''}REFERENCE: ${reference}
${adminUrl ? `
Review: ${adminUrl}
` : ''}
They are waiting on a review before they can pay.
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
      subheading: `Payment of ${money(amountZAR)} received · ${attendeeCount} ${attendeeCount === 1 ? 'attendee' : 'attendees'}`,
      body: `<p style="margin:0 0 16px;">Hi ${esc(contactName)},</p>
<p style="margin:0 0 16px;">Payment of <strong style="color:${WHITE};">${money(amountZAR)}</strong> received. <strong style="color:${WHITE};">${esc(businessName)}</strong> is officially confirmed for <strong style="color:${WHITE};">${esc(EVENT.fullName)}</strong> (${attendeeCount} ${attendeeCount === 1 ? 'attendee' : 'attendees'}).</p>
<p style="margin:0 0 16px;"><strong>What to expect:</strong> On arrival you will receive your welcome pack. You will also have the floor during the SME Spotlight to introduce your business to the room.</p>
<p style="margin:0;">Proceeds go towards supplies for the ${esc(EVENT.causeShort)}. We look forward to hosting you.</p>`,
      panel: {
        label: 'Your Digital Ticket Code',
        value: ticketCode,
        note: 'Present this ticket code upon arrival at registration.',
      },
      eventCard: true,
    }),
    text: `Hi ${contactName},

Payment of ${money(amountZAR)} received. ${businessName} is officially confirmed for ${EVENT.fullName} (${attendeeCount} ${attendeeCount === 1 ? 'attendee' : 'attendees'}).

EVENT DETAILS:
- Date: Friday, ${EVENT.dateLabel}
- Time: ${EVENT.timeLabel} (Registration opens 08:30)
- Location: ${EVENT.venueCity}
- Includes: Light breakfast, morning refreshments, and welcome pack

WHAT TO EXPECT:
On arrival you will receive your welcome pack. You will also have the floor during the SME Spotlight to introduce your business to the room.

YOUR TICKET CODE: ${ticketCode}
Present this code upon arrival at registration.

100% of every donation funds the ${EVENT.causeShort}. We look forward to hosting you!
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
      subheading: `Your generosity makes a difference`,
      body: `<p style="margin:0 0 16px;">Hi ${esc(name)},</p>
<p style="margin:0 0 16px;">Your donation of <strong style="color:${WHITE};">${money(amountZAR)}</strong> has been received, and goes in full towards supplies for the ${esc(EVENT.cause)}.</p>
<p style="margin:0;">This email is your receipt.</p>`,
      panel: {
        label: 'Receipt reference',
        value: reference,
        note: `${money(amountZAR)} received`,
      },
    }),
    text: `Hi ${name},

Your donation of ${money(amountZAR)} has been received, and goes in full
towards supplies for the ${EVENT.cause}.

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
    <tr>
      <td style="padding:12px 0;font-family:'Courier New',Courier,monospace;font-size:12px;color:${GOLD};width:130px;vertical-align:top;border-bottom:1px solid ${DIVIDER_SUBTLE};">${esc(p.time)}</td>
      <td style="padding:12px 0;vertical-align:top;border-bottom:1px solid ${DIVIDER_SUBTLE};">
        <div style="font-weight:bold;color:${BONE};font-size:13px;">${esc(p.title)}</div>
        <div style="color:${MUTED};font-size:12px;margin-top:3px;line-height:1.5;">${esc(p.detail)}</div>
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
      subheading: `${dateLabel} · ${venueCity}`,
      body: `<p style="margin:0 0 16px;">Hi ${esc(contactName)},</p>
<p style="margin:0 0 16px;">Here is the latest schedule for <strong style="color:${WHITE};">${esc(businessName)}</strong> for <strong style="color:${WHITE};">${esc(EVENT.fullName)}</strong> on <strong style="color:${WHITE};">${esc(dateLabel)}</strong> in ${esc(venueCity)}.</p>
${customMessage ? `<p style="margin:0 0 16px;color:${GOLD};font-style:italic;">${esc(customMessage)}</p>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
  ${agendaHtml}
</table>
<p style="margin:16px 0 0;font-size:13px;color:${MUTED};">We look forward to hosting you!</p>`,
    }),
    text: `Hi ${contactName},

Here is the latest schedule for ${businessName} for ${EVENT.fullName} on ${dateLabel} in ${venueCity}.

${customMessage ? `${customMessage}\n\n` : ''}PROGRAMME:
${agendaText}

We look forward to hosting you!
${textFooter()}`,
  };
}
