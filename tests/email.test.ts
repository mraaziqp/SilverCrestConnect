/**
 * Email tests.
 *
 * Two things are worth locking down here. First, escaping: a business name is
 * user input and goes straight into an HTML email, so an unescaped angle
 * bracket is a live injection into someone's inbox. Second, the plain-text
 * part: it is easy to change the HTML and forget the text, and a missing or
 * stale text part quietly hurts deliverability.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applicationApproved,
  applicationReceived,
  donationReceipt,
  ticketConfirmed,
} from '../src/server/email/render.ts';
import { createMailer, loadMailerConfig, describeMailer } from '../src/server/email/mailer.ts';

const RENDERERS = [
  {
    name: 'applicationReceived',
    build: () =>
      applicationReceived({
        contactName: 'Wesley Bosman',
        businessName: 'Bosman & Sons Catering',
        reference: 'SCC26-ABC123',
      }),
  },
  {
    name: 'applicationApproved',
    build: () =>
      applicationApproved({
        contactName: 'Wesley Bosman',
        businessName: 'Bosman & Sons Catering',
        reference: 'SCC26-ABC123',
        payUrl: 'https://example.co.za/pay/SCC26-ABC123',
        seatsRemaining: 3,
      }),
  },
  {
    name: 'ticketConfirmed',
    build: () =>
      ticketConfirmed({
        contactName: 'Wesley Bosman',
        businessName: 'Bosman & Sons Catering',
        ticketCode: 'TICKET-XYZ789',
        amountZAR: 350,
      }),
  },
  {
    name: 'donationReceipt',
    build: () => donationReceipt({ name: 'Aisha Patel', amountZAR: 250, reference: 'DON-QQ1122' }),
  },
];

test('every template produces a subject, HTML and matching plain text', () => {
  for (const { name, build } of RENDERERS) {
    const mail = build();
    assert.ok(mail.subject.length > 0, `${name} needs a subject`);
    assert.ok(mail.subject.length <= 120, `${name} subject is too long for an inbox list`);
    assert.match(mail.html, /^<!doctype html>/i, `${name} needs a full HTML document`);
    assert.ok(mail.text.trim().length > 80, `${name} needs a real plain-text part`);
    // A stray template literal that failed to interpolate.
    assert.doesNotMatch(mail.html, /\$\{/, `${name} has an uninterpolated placeholder`);
    assert.doesNotMatch(mail.text, /\$\{/, `${name} has an uninterpolated placeholder`);
  }
});

test('user-supplied names are HTML-escaped in the HTML part', () => {
  const mail = applicationReceived({
    contactName: '<script>alert(1)</script>',
    businessName: 'Evil & Co "quoted"',
    reference: 'SCC26-ABC123',
  });

  assert.doesNotMatch(mail.html, /<script>/, 'a script tag must never survive into the HTML');
  assert.match(mail.html, /&lt;script&gt;/);
  assert.match(mail.html, /Evil &amp; Co/);
  assert.match(mail.html, /&quot;quoted&quot;/);
});

test('the approval email carries the payment link in both parts', () => {
  const payUrl = 'https://connect.example.co.za/pay/SCC26-ABC123';
  const mail = applicationApproved({
    contactName: 'Wesley',
    businessName: 'Bosman Catering',
    reference: 'SCC26-ABC123',
    payUrl,
    seatsRemaining: 3,
  });

  assert.ok(mail.html.includes(payUrl), 'HTML part must link to the payment page');
  assert.ok(mail.text.includes(payUrl), 'text part must include the raw URL');
  // Low seat counts should nudge; this is the one email where urgency is fair.
  assert.match(mail.text, /Only 3 seats remaining/);
});

test('the approval email drops the scarcity line when seats are plentiful', () => {
  const mail = applicationApproved({
    contactName: 'Wesley',
    businessName: 'Bosman Catering',
    reference: 'SCC26-ABC123',
    payUrl: 'https://example.co.za/pay/X',
    seatsRemaining: 18,
  });
  assert.doesNotMatch(mail.text, /remaining/);
});

test('the approval email uses singular wording for one seat', () => {
  const mail = applicationApproved({
    contactName: 'Wesley',
    businessName: 'Bosman Catering',
    reference: 'SCC26-ABC123',
    payUrl: 'https://example.co.za/pay/X',
    seatsRemaining: 1,
  });
  assert.match(mail.text, /Only 1 seat remaining/);
});

test('the ticket email contains the ticket code, not just the reference', () => {
  const mail = ticketConfirmed({
    contactName: 'Wesley',
    businessName: 'Bosman Catering',
    ticketCode: 'TICKET-XYZ789',
    amountZAR: 350,
  });
  assert.ok(mail.html.includes('TICKET-XYZ789'));
  assert.ok(mail.text.includes('TICKET-XYZ789'));
});

test('money is formatted consistently across templates', () => {
  const receipt = donationReceipt({ name: 'Aisha', amountZAR: 1234.5, reference: 'DON-1' });
  assert.ok(receipt.text.includes('R1 234.50'), 'thousands grouped, period decimal');
  assert.ok(receipt.subject.includes('R1 234.50'));
});

test('mailer falls back to the console driver with no API key', () => {
  const mailer = createMailer(loadMailerConfig({} as NodeJS.ProcessEnv));
  assert.equal(mailer.driver, 'console');
  assert.equal(mailer.configured, false);

  const described = describeMailer(mailer);
  assert.equal(described.warnings.length >= 1, true, 'an unconfigured mailer must warn');
  assert.match(described.warnings[0], /not delivered/);
});

test('mailer uses Resend when an API key is present', () => {
  const mailer = createMailer(
    loadMailerConfig({ RESEND_API_KEY: 'test_key_123' } as NodeJS.ProcessEnv),
  );
  assert.equal(mailer.driver, 'resend');
  assert.equal(mailer.configured, true);
});

test('a bare EMAIL_FROM gains a display name', () => {
  const config = loadMailerConfig({
    EMAIL_FROM: 'connect@scconnect.co.za',
    EMAIL_FROM_NAME: 'Silver Crest Connect',
  } as NodeJS.ProcessEnv);
  assert.equal(config.from, 'Silver Crest Connect <connect@scconnect.co.za>');
});

test('an EMAIL_FROM that already has a display name is left alone', () => {
  const config = loadMailerConfig({
    EMAIL_FROM: 'Custom Name <hi@example.co.za>',
  } as NodeJS.ProcessEnv);
  assert.equal(config.from, 'Custom Name <hi@example.co.za>');
});

test('the console driver reports success so a payment is never rolled back', async () => {
  const mailer = createMailer(loadMailerConfig({} as NodeJS.ProcessEnv));
  const result = await mailer.send('someone@example.co.za', donationReceipt({
    name: 'Test',
    amountZAR: 100,
    reference: 'DON-TEST',
  }));
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
});

test('approval and confirmation emails reflect 2 representatives and R900 pricing', () => {
  const approvedMail = applicationApproved({
    contactName: 'Wesley',
    businessName: 'Bosman Catering',
    reference: 'SCC26-REP2',
    payUrl: 'https://example.co.za/pay/SCC26-REP2',
    seatsRemaining: 10,
    attendeeCount: 2,
    totalAmountZAR: 900,
  });

  assert.ok(approvedMail.html.includes('R900.00'), 'approval must show R900 for 2 reps');
  assert.ok(approvedMail.text.includes('2 attendees'), 'approval must note 2 attendees');

  const ticketMail = ticketConfirmed({
    contactName: 'Wesley',
    businessName: 'Bosman Catering',
    ticketCode: 'TICKET-REP2',
    amountZAR: 900,
    attendeeCount: 2,
  });

  assert.ok(ticketMail.html.includes('R900.00'), 'ticket must confirm R900');
  assert.ok(ticketMail.subject.includes("YOU'RE CONFIRMED"), 'subject matches format');
  assert.ok(ticketMail.text.includes('Light breakfast'), 'includes light breakfast notice');
});


/**
 * The approval email must not send anyone to a payment page that cannot take
 * their money. With payments closed it confirms the approval and says a link
 * follows — carrying no payment URL at all, in either MIME part.
 */
test('an approval sent while payments are closed carries no payment link', () => {
  const mail = applicationApproved({
    contactName: 'Thandi',
    businessName: 'Audit Traders',
    reference: 'SCC26-ABC123',
    payUrl: 'https://scconnect.co.za/pay/SCC26-ABC123',
    seatsRemaining: 12,
    attendeeCount: 2,
    totalAmountZAR: 900,
    paymentsOpen: false,
  });

  assert.equal(mail.html.includes('/pay/SCC26-ABC123'), false, 'html must not link to payment');
  assert.equal(mail.text.includes('/pay/SCC26-ABC123'), false, 'text must not link to payment');
  assert.doesNotMatch(mail.subject, /Secure your seat/);
  assert.match(mail.text, /Payment is not open just yet/);
  // The approval itself, and the amount to expect, still have to come through.
  assert.match(mail.text, /has been approved/);
  assert.match(mail.text, /R900\.00/);
  assert.match(mail.text, /SCC26-ABC123/);
});

test('an approval sent while payments are open still links to payment', () => {
  const mail = applicationApproved({
    contactName: 'Thandi',
    businessName: 'Audit Traders',
    reference: 'SCC26-ABC123',
    payUrl: 'https://scconnect.co.za/pay/SCC26-ABC123',
    seatsRemaining: 12,
    attendeeCount: 1,
    totalAmountZAR: 450,
    paymentsOpen: true,
  });

  assert.ok(mail.html.includes('/pay/SCC26-ABC123'));
  assert.ok(mail.text.includes('/pay/SCC26-ABC123'));
  assert.match(mail.subject, /Secure your seat/);
});
