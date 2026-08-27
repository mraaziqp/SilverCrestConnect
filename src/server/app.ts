/**
 * Express application factory.
 *
 * Split out from the server entrypoint so the same app can be mounted by the
 * standalone Node server (server.ts) and by a serverless handler (api/index.ts)
 * without duplicating route definitions.
 */

import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import crypto from 'crypto';

import { EVENT, DONATION_MIN_ZAR, DONATION_MAX_ZAR } from '../config/event.js';
import type {
  Application,
  ApplicationStatus,
  DashboardStats,
  ImpactItem,
  Payment,
  ProgrammeItem,
  WelcomePackItem,
} from '../types.js';
import { makeId, makeReference } from './store.js';
import { seatsFor, type DataStore } from './store-types.js';
import {
  buildPaymentFields,
  describeConfig,
  processUrl,
  verifyItn,
  type PayFastConfig,
} from './payfast.js';
import { validateSettings, validateItems } from './settings-validate.js';
import { ImageStorage, loadStorageConfig } from './storage.js';
import {
  FieldErrors,
  email as validEmail,
  money,
  optionalString,
  phone as validPhone,
  requiredString,
  splitName,
} from './validate.js';
import {
  createMailer,
  describeMailer,
  loadMailerConfig,
  sendInBackground,
  type Mailer,
  type MailerConfig,
} from './email/mailer.js';
import {
  applicationApproved,
  applicationReceived,
  donationReceipt,
  ticketConfirmed,
  programmeBroadcastEmail,
} from './email/render.js';

export interface AppOptions {
  store: DataStore;
  payfast: PayFastConfig;
  /** Outbound email. Defaults to the console driver when omitted. */
  mailer?: Mailer;
  /** Mail settings, used only to report configuration health in /admin. */
  mailerConfig?: MailerConfig;
  /** Absolute path to the built client, when serving production assets. */
  distPath?: string;
  /** Attach the Vite dev middleware instead of static assets. */
  attachVite?: (app: Express) => Promise<void>;
}

/** Statuses from which a ticket payment may be started. */
const PAYABLE_STATUSES: ApplicationStatus[] = ['APPROVED'];

export async function createApp(options: AppOptions): Promise<Express> {
  const { store, payfast } = options;
  const mailerConfig = options.mailerConfig ?? loadMailerConfig();
  const mailer = options.mailer ?? createMailer(mailerConfig);
  const imageStorage = new ImageStorage(loadStorageConfig());
  const app = express();

  // Behind Vercel/Render/nginx, req.ip must come from X-Forwarded-For for the
  // ITN source-IP check to see the real client.
  //
  // One hop, deliberately. PayFast posts the ITN straight to this service, so
  // one hop is exactly right for the check that has to be trustworthy. Browser
  // traffic may arrive via a second proxy when the client is hosted separately
  // — there req.ip is that proxy, which is why the rate limiters below key on
  // clientKey() instead of req.ip.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(securityHeaders);

  // The ITN endpoint needs the raw body to rebuild PayFast's signature string
  // in the exact field order it was posted, so it is parsed before the
  // generic JSON parser and keeps a copy of the raw text.
  app.post(
    '/api/payfast/itn',
    express.urlencoded({
      extended: false,
      verify: (req, _res, buf) => {
        (req as RawBodyRequest).rawBody = buf.toString('utf8');
      },
    }),
    (req, res) => handleItn(req, res, store, payfast, mailer),
  );

  // 8mb, not 64kb: the dashboard posts images as data URIs, and base64 adds
  // about a third on top of the 5mb file limit the uploader enforces.
  app.use(express.json({ limit: '8mb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));

  // ------------------------------------------------------------------ public API

  app.get('/api/health', async (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      event: EVENT.fullName,
      presentedBy: EVENT.presentedBy,
      persistent: store.isPersistent,
      storage: store.storageNote,
      payfastConfigured: payfast.isConfigured,
      payfastMode: payfast.mode,
      timestamp: new Date().toISOString(),
    });
  });

  /** Public event facts, so the client never hardcodes a second copy. */
  app.get('/api/event', async (_req: Request, res: Response) => {
    const stats = await buildStats(store);
    const settings = await store.getSettings();
    res.json({
      success: true,
      event: settings,
      welcomePack: await store.getWelcomePack(),
      impactItems: await store.getImpactItems(),
      gallery: await store.getGallery(),
      seatsRemaining: stats.seatsRemaining,
      totalRaisedZAR: stats.totalRaisedZAR,
      supporters: stats.donationsCount,
    });
  });

  /**
   * SME application (funnel step 01).
   * Applying is free — no payment is taken until the team approves.
   */
  app.post('/api/applications', rateLimit(5, 60_000), async (req: Request, res: Response) => {
    const errors = new FieldErrors();
    const body = req.body ?? {};

    const businessName = requiredString(errors, 'businessName', body.businessName, { min: 2, max: 120, label: 'Business name' });
    const contactName = requiredString(errors, 'contactName', body.contactName, { min: 2, max: 100, label: 'Contact name' });
    const applicantRole = requiredString(errors, 'applicantRole', body.applicantRole, { min: 2, max: 100, label: 'Role / position' });
    const email = validEmail(errors, 'email', body.email);
    const phone = validPhone(errors, 'phone', body.phone);
    const industry = requiredString(errors, 'industry', body.industry, { min: 2, max: 80, label: 'Industry' });
    const about = requiredString(errors, 'about', body.about, { min: 20, max: 1000, label: 'Business description' });
    const productsServices = requiredString(errors, 'productsServices', body.productsServices, { min: 5, max: 1000, label: 'Products / services' });
    const communityContribution = requiredString(errors, 'communityContribution', body.communityContribution, { min: 5, max: 1000, label: 'Community contribution' });

    const attendeeCount = (Number(body.attendeeCount) === 2 ? 2 : 1) as 1 | 2;
    let rep2Name: string | undefined;
    let rep2Role: string | undefined;
    let rep2Email: string | undefined;
    let rep2Phone: string | undefined;

    if (attendeeCount === 2) {
      rep2Name = requiredString(errors, 'rep2Name', body.rep2Name, { min: 2, max: 100, label: 'Second attendee name' });
      rep2Role = requiredString(errors, 'rep2Role', body.rep2Role, { min: 2, max: 100, label: 'Second attendee role' });
      rep2Email = validEmail(errors, 'rep2Email', body.rep2Email);
      rep2Phone = validPhone(errors, 'rep2Phone', body.rep2Phone);
    }

    if (errors.any) {
      return res.status(400).json({ success: false, error: 'Please correct the highlighted fields.', fieldErrors: errors.all });
    }

    // One application per email keeps the vetting list clean and stops an
    // accidental double-submit creating two records.
    const existing = await store.findApplicationByEmail(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'An application already exists for this email address.',
        reference: existing.reference,
        status: existing.status,
      });
    }

    const settings = await store.getSettings();
    const totalPriceZAR = attendeeCount === 2 ? settings.ticketPriceZAR * 2 : settings.ticketPriceZAR;

    const now = new Date().toISOString();
    const application: Application = {
      id: makeId('app'),
      reference: makeReference('SCC26'),
      businessName,
      contactName,
      applicantRole,
      email,
      phone,
      industry,
      website: optionalString(body.website, 200),
      registrationNumber: optionalString(body.registrationNumber, 40),
      about,
      productsServices,
      communityContribution,
      lookingFor: optionalString(body.lookingFor, 300),
      attendeeCount,
      totalPriceZAR,
      rep2Name,
      rep2Role,
      rep2Email,
      rep2Phone,
      status: 'PENDING_REVIEW',
      createdAt: now,
      updatedAt: now,
    };

    await store.addApplication(application);

    sendInBackground(
      mailer,
      application.email,
      applicationReceived({
        contactName: application.contactName,
        businessName: application.businessName,
        reference: application.reference,
        attendeeCount: application.attendeeCount,
      }),
      'application-received',
    );

    return res.status(201).json({
      success: true,
      reference: application.reference,
      status: application.status,
      message: 'Application received. The Silver Crest team will review it and email your payment link once approved.',
    });
  });

  /** Applicant-facing status lookup, keyed on the reference we emailed them. */
  app.get('/api/applications/:reference', async (req: Request, res: Response) => {
    const application = await store.getApplication(req.params.reference);
    if (!application) {
      return res.status(404).json({ success: false, error: 'No application found for that reference.' });
    }

    const settings = await store.getSettings();
    const isPaid = application.status === 'PAID';
    const attendeeCount = application.attendeeCount || 1;
    const totalPriceZAR =
      application.totalPriceZAR || (attendeeCount === 2 ? settings.ticketPriceZAR * 2 : settings.ticketPriceZAR);

    return res.json({
      success: true,
      application: {
        reference: application.reference,
        businessName: application.businessName,
        status: application.status,
        attendeeCount,
        totalPriceZAR,
        rep2Name: application.rep2Name,
        ticketCode: application.ticketCode,
        createdAt: application.createdAt,
      },
      event: settings,
      programme: isPaid ? await store.getProgramme() : undefined,
    });
  });

  /**
   * Starts a PayFast checkout for an approved SME's ticket.
   * The amount is calculated dynamically based on 1 vs 2 representatives.
   */
  app.post('/api/checkout/ticket', rateLimit(10, 60_000), async (req: Request, res: Response) => {
    const reference = typeof req.body?.reference === 'string' ? req.body.reference.trim() : '';
    if (!reference) {
      return res.status(400).json({ success: false, error: 'An application reference is required.' });
    }

    const application = await store.getApplication(reference);
    if (!application) {
      return res.status(404).json({ success: false, error: 'No application found for that reference.' });
    }
    if (application.status === 'PAID') {
      return res.status(409).json({ success: false, error: 'This ticket has already been paid for.' });
    }
    if (!PAYABLE_STATUSES.includes(application.status)) {
      return res.status(409).json({
        success: false,
        error:
          application.status === 'PENDING_REVIEW'
            ? 'This application is still being reviewed. You will be emailed your payment link once approved.'
            : 'This application is not currently eligible for payment.',
      });
    }

    const settings = await store.getSettings();
    // Capacity is enforced here as well as in the admin approval step, because
    // approvals and payments race: several approved SMEs could pay at once.
    // The booking is weighed whole — letting a two-representative business
    // through on a single remaining seat would seat 51 people in a room of 50.
    const seatsTaken = await store.countPaidSeats();
    const seatsWanted = seatsFor(application);
    if (seatsTaken + seatsWanted > settings.capacity) {
      return res.status(409).json({
        success: false,
        error:
          seatsTaken >= settings.capacity
            ? 'All seats for this event have been taken. Contact us to join the waiting list.'
            : 'Only one seat is left, and this application is for two representatives. Contact us to adjust the booking or join the waiting list.',
      });
    }

    const attendeeCount = application.attendeeCount || 1;
    const amountZAR =
      application.totalPriceZAR || (attendeeCount === 2 ? settings.ticketPriceZAR * 2 : settings.ticketPriceZAR);

    const { first, last } = splitName(application.contactName);
    const payment: Payment = {
      id: makeId('pay'),
      reference: makeReference('TKT'),
      kind: 'TICKET',
      amountZAR,
      status: 'PENDING',
      name: application.contactName,
      email: application.email,
      applicationId: application.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await store.addPayment(payment);

    const fields = buildPaymentFields(payfast, {
      reference: payment.reference,
      amountZAR: payment.amountZAR,
      itemName: `${EVENT.fullName} - ${attendeeCount === 2 ? '2 Representatives' : 'SME Ticket'}`,
      itemDescription: `Attendance for ${application.businessName} (${attendeeCount} attendee${attendeeCount === 2 ? 's' : ''}, incl. breakfast) on ${EVENT.dateLabel}. 100% funds ${EVENT.causeShort}.`,
      nameFirst: first,
      nameLast: last,
      email: application.email,
      cellNumber: application.phone,
      customStr1: payment.id,
      customStr2: application.reference,
    });

    return res.json({
      success: true,
      paymentId: payment.id,
      reference: payment.reference,
      amountZAR: payment.amountZAR,
      processUrl: processUrl(payfast),
      fields,
    });
  });

  /** Starts a PayFast checkout for a custom-amount donation to the outreach drive. */
  app.post('/api/checkout/donation', rateLimit(10, 60_000), async (req: Request, res: Response) => {
    const errors = new FieldErrors();
    const body = req.body ?? {};

    const name = requiredString(errors, 'name', body.name, { min: 2, max: 100, label: 'Your name' });
    const email = validEmail(errors, 'email', body.email);
    const amountZAR = money(errors, 'amount', body.amount, {
      min: DONATION_MIN_ZAR,
      max: DONATION_MAX_ZAR,
      label: 'Donation amount',
    });

    if (errors.any) {
      return res.status(400).json({ success: false, error: 'Please correct the highlighted fields.', fieldErrors: errors.all });
    }

    const { first, last } = splitName(name);
    const payment: Payment = {
      id: makeId('pay'),
      reference: makeReference('DON'),
      kind: 'DONATION',
      amountZAR,
      status: 'PENDING',
      name,
      email,
      message: optionalString(body.message, 200),
      anonymous: body.anonymous === true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await store.addPayment(payment);

    const fields = buildPaymentFields(payfast, {
      reference: payment.reference,
      amountZAR,
      itemName: `${EVENT.causeShort} - Donation`,
      itemDescription: `Contribution towards ${EVENT.cause}.`,
      nameFirst: first,
      nameLast: last,
      email,
      customStr1: payment.id,
    });

    return res.json({
      success: true,
      paymentId: payment.id,
      reference: payment.reference,
      amountZAR,
      processUrl: processUrl(payfast),
      fields,
    });
  });

  /**
   * Polled by the return page while it waits for the ITN to land.
   * PayFast redirects the browser back before the server callback necessarily
   * arrives, so the UI cannot treat "returned" as "paid".
   */
  app.get('/api/payments/:reference/status', async (req: Request, res: Response) => {
    const payment = await store.getPayment(req.params.reference);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found.' });
    }

    const application = payment.applicationId
      ? await store.getApplication(payment.applicationId)
      : undefined;

    return res.json({
      success: true,
      payment: {
        reference: payment.reference,
        kind: payment.kind,
        amountZAR: payment.amountZAR,
        status: payment.status,
        createdAt: payment.createdAt,
      },
      ticketCode: application?.ticketCode,
      businessName: application?.businessName,
    });
  });

  /** Public supporters wall — named donations only, no emails or amounts leaked. */
  app.get('/api/supporters', async (_req: Request, res: Response) => {
    const supporters = (await store.completedPayments())
      .filter((p) => p.kind === 'DONATION' && !p.anonymous)
      .slice(0, 60)
      .map((p) => ({
        name: p.name,
        message: p.message,
        at: p.updatedAt,
      }));

    res.json({ success: true, count: supporters.length, supporters });
  });

  // ------------------------------------------------------------------- admin API

  app.use('/api/admin', adminAuth);

  app.get('/api/admin/overview', async (_req: Request, res: Response) => {
    res.json({
      success: true,
      stats: await buildStats(store),
      payfast: describeConfig(payfast),
      email: describeMailer(mailer, mailerConfig),
      storage: {
        persistent: store.isPersistent,
        note: store.storageNote,
      },
    });
  });

  app.get('/api/admin/applications', async (req: Request, res: Response) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    let list = await store.listApplications();
    if (status && status !== 'ALL') {
      list = list.filter((a) => a.status === status);
    }
    res.json({ success: true, count: list.length, applications: list });
  });

  /** Moves an application through the vetting funnel. */
  app.patch('/api/admin/applications/:id', async (req: Request, res: Response) => {
    const allowed: ApplicationStatus[] = ['PENDING_REVIEW', 'APPROVED', 'PAID', 'REJECTED', 'WAITLISTED'];
    const status = req.body?.status as ApplicationStatus | undefined;

    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ success: false, error: `status must be one of: ${allowed.join(', ')}` });
    }

    const application = await store.getApplication(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }

    // Marking someone PAID by hand is for off-platform payments (EFT, cash at
    // the door). It still has to respect the room capacity, counting the whole
    // booking — a two-representative business needs two free seats, not one.
    if (status === 'PAID' && application.status !== 'PAID') {
      const { capacity } = await store.getSettings();
      const seatsTaken = await store.countPaidSeats();
      const seatsWanted = seatsFor(application);
      if (seatsTaken + seatsWanted > capacity) {
        return res.status(409).json({
          success: false,
          error:
            seatsTaken >= capacity
              ? 'The event is at capacity.'
              : `Only ${capacity - seatsTaken} seat(s) remain and this application is for ${seatsWanted}.`,
        });
      }
    }

    const wasApproved = application.status === 'APPROVED';

    const updated = await store.updateApplication(application.id, {
      status,
      reviewNote: optionalString(req.body?.reviewNote, 500) ?? application.reviewNote,
      reviewedAt: new Date().toISOString(),
      ticketCode:
        status === 'PAID' && !application.ticketCode
          ? makeReference('TICKET')
          : application.ticketCode,
    });

    // Email the payment link only on the transition INTO approved, so
    // re-saving an already-approved application does not re-notify them.
    // `resend: true` in the body forces it, for when the first mail bounced.
    if (updated && status === 'APPROVED' && (!wasApproved || req.body?.resend === true)) {
      const settings = await store.getSettings();
      const attendeeCount = updated.attendeeCount || 1;
      const totalAmountZAR =
        updated.totalPriceZAR || (attendeeCount === 2 ? settings.ticketPriceZAR * 2 : settings.ticketPriceZAR);

      sendInBackground(
        mailer,
        updated.email,
        applicationApproved({
          contactName: updated.contactName,
          businessName: updated.businessName,
          reference: updated.reference,
          payUrl: `${payfast.appUrl}/pay/${encodeURIComponent(updated.reference)}`,
          seatsRemaining: Math.max(0, settings.capacity - await store.countPaidSeats()),
          attendeeCount,
          totalAmountZAR,
        }),
        'application-approved',
      );
    }

    // A manual PAID (EFT or cash at the door) still deserves a ticket email.
    if (updated && status === 'PAID' && application.status !== 'PAID' && updated.ticketCode) {
      const settings = await store.getSettings();
      const attendeeCount = updated.attendeeCount || 1;
      const totalAmountZAR =
        updated.totalPriceZAR || (attendeeCount === 2 ? settings.ticketPriceZAR * 2 : settings.ticketPriceZAR);

      sendInBackground(
        mailer,
        updated.email,
        ticketConfirmed({
          contactName: updated.contactName,
          businessName: updated.businessName,
          ticketCode: updated.ticketCode,
          amountZAR: totalAmountZAR,
          attendeeCount,
        }),
        'ticket-confirmed-manual',
      );
    }

    return res.json({ success: true, application: updated });
  });

  app.get('/api/admin/payments', async (req: Request, res: Response) => {
    const kind = typeof req.query.kind === 'string' ? req.query.kind : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    let list = await store.listPayments();
    if (kind && kind !== 'ALL') list = list.filter((p) => p.kind === kind);
    if (status && status !== 'ALL') list = list.filter((p) => p.status === status);

    res.json({ success: true, count: list.length, payments: list });
  });

  /** CSV export for reconciling against the PayFast dashboard. */
  app.get('/api/admin/payments.csv', async (_req: Request, res: Response) => {
    const rows = [
      ['reference', 'kind', 'status', 'amount_zar', 'net_zar', 'fee_zar', 'name', 'email', 'pf_payment_id', 'created_at'],
      ...(await store.listPayments()).map((p) => [
        p.reference,
        p.kind,
        p.status,
        p.amountZAR.toFixed(2),
        p.amountNetZAR?.toFixed(2) ?? '',
        p.feeZAR?.toFixed(2) ?? '',
        p.name,
        p.email,
        p.pfPaymentId ?? '',
        p.createdAt,
      ]),
    ];

    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="silvercrest-payments-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  });

  // --- Dynamic Content & Settings Management ---

  app.get('/api/admin/settings', async (_req: Request, res: Response) => {
    res.json({
      success: true,
      settings: await store.getSettings(),
      programme: await store.getProgramme(),
      welcomePack: await store.getWelcomePack(),
      impactItems: await store.getImpactItems(),
      gallery: await store.getGallery(),
    });
  });

  app.put('/api/admin/settings', async (req: Request, res: Response) => {
    // Validated rather than written through: a typo here would otherwise
    // persist a broken price or capacity and take checkout down for everyone.
    const { settings, errors } = validateSettings(req.body, await store.getSettings());

    if (Object.keys(settings).length === 0 && Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: 'None of the supplied settings were valid.',
        fieldErrors: errors,
      });
    }

    const updated = await store.updateSettings(settings);
    // Partial success is reported, not swallowed — the dashboard shows which
    // fields did not take.
    return res.json({
      success: true,
      settings: updated,
      ...(Object.keys(errors).length > 0 ? { fieldErrors: errors } : {}),
    });
  });

  app.put('/api/admin/programme', async (req: Request, res: Response) => {
    const { items, error } = validateItems<ProgrammeItem>(req.body?.items, {
      time: 40,
      duration: 40,
      title: 160,
      detail: 500,
      kind: 20,
    });
    if (error) return res.status(400).json({ success: false, error });

    const updated = await store.updateProgramme(items);
    return res.json({ success: true, programme: updated });
  });

  /** Broadcast the latest programme schedule via email to all paid attendees. */
  app.post('/api/admin/programme/broadcast', async (req: Request, res: Response) => {
    const paidAttendees = (await store.listApplications()).filter((a) => a.status === 'PAID');
    const programme = await store.getProgramme();
    const settings = await store.getSettings();
    const customMessage = typeof req.body?.message === 'string' ? req.body.message.trim() : undefined;

    let sentCount = 0;
    for (const attendee of paidAttendees) {
      if (attendee.email) {
        sendInBackground(
          mailer,
          attendee.email,
          programmeBroadcastEmail({
            contactName: attendee.contactName,
            businessName: attendee.businessName,
            dateLabel: settings.dateLabel,
            venueCity: settings.venueCity,
            customMessage,
            programme,
          }),
          'programme-broadcast',
        );
        sentCount++;
      }
    }

    res.json({
      success: true,
      sentCount,
      totalPaid: paidAttendees.length,
      message: `Programme broadcast dispatched to ${sentCount} paid attendee(s).`,
    });
  });

  app.put('/api/admin/welcome-pack', async (req: Request, res: Response) => {
    const { items, error } = validateItems<WelcomePackItem>(req.body?.items, { title: 120, body: 500 });
    if (error) return res.status(400).json({ success: false, error });

    const updated = await store.updateWelcomePack(items);
    return res.json({ success: true, welcomePack: updated });
  });

  app.put('/api/admin/impact-items', async (req: Request, res: Response) => {
    const { items, error } = validateItems<ImpactItem>(req.body?.items, { title: 120, body: 500 });
    if (error) return res.status(400).json({ success: false, error });

    const updated = await store.updateImpactItems(items);
    return res.json({ success: true, impactItems: updated });
  });

  app.put('/api/admin/gallery', async (req: Request, res: Response) => {
    const { items, error } = validateItems<{ url: string; caption: string }>(
      req.body?.items,
      { url: 200_000, caption: 200 },
      40,
    );
    if (error) return res.status(400).json({ success: false, error });

    // Reject anything that is not an image reference before it reaches a page.
    const cleaned = [];
    for (const item of items) {
      const url = item.url.trim();
      if (!url) continue;
      if (!/^https?:\/\//i.test(url) && !url.startsWith('data:image/')) {
        return res.status(400).json({
          success: false,
          error: `"${url.slice(0, 40)}" is not an image URL. Use an https link or upload a file.`,
        });
      }
      cleaned.push({ id: makeId('img'), url, caption: item.caption || undefined });
    }

    const updated = await store.updateGallery(cleaned);
    return res.json({ success: true, gallery: updated });
  });

  /** Reports whether direct upload is possible, so the UI can adapt. */
  app.get('/api/admin/storage-status', async (_req: Request, res: Response) => {
    const available = await imageStorage.isAvailable();
    return res.json({
      success: true,
      available,
      note: available
        ? 'Image upload is available.'
        : 'Image upload is unavailable — paste an image URL instead. Enable Firebase Storage to upload directly.',
    });
  });

  app.post('/api/admin/upload-image', async (req: Request, res: Response) => {
    const dataUri = typeof req.body?.dataUri === 'string' ? req.body.dataUri : '';
    if (!dataUri) {
      return res.status(400).json({ success: false, error: 'No image supplied.' });
    }

    const folder = req.body?.folder === 'logo' ? 'logo' : 'gallery';
    const result = await imageStorage.upload(dataUri, folder);
    if (!result.ok) return res.status(400).json({ success: false, error: result.error });

    return res.json({ success: true, url: result.url });
  });

  app.post('/api/admin/upload-logo', async (req: Request, res: Response) => {
    const { settings, errors } = validateSettings(
      { customLogoUrl: req.body?.logoUrl },
      await store.getSettings(),
    );
    if (errors.customLogoUrl) {
      return res.status(400).json({ success: false, error: errors.customLogoUrl });
    }

    const updated = await store.updateSettings(settings);
    return res.json({ success: true, customLogoUrl: updated.customLogoUrl });
  });

  // Anything still unmatched under /api is a genuine 404 and must answer with
  // JSON. This has to come BEFORE the client middleware: otherwise Vite (dev)
  // or the SPA fallback (prod) serves index.html for a mistyped API path, and
  // the client's response.json() fails with a confusing parse error instead of
  // a clear 404.
  app.use('/api', async (_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: 'Unknown API endpoint.' });
  });

  // ------------------------------------------------------------- client delivery

  if (options.attachVite) {
    await options.attachVite(app);
  } else if (options.distPath) {
    const distPath = options.distPath;
    app.use(express.static(distPath, { index: false, maxAge: '1h' }));

    // SPA fallback for every non-API route.
    app.get(/^\/(?!api\/).*/, async (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use(errorHandler);

  return app;
}

// ---------------------------------------------------------------------- handlers

interface RawBodyRequest extends Request {
  rawBody?: string;
}

/**
 * PayFast ITN callback. This is the only thing that may mark a payment
 * complete — the browser return URL is not trusted, because a user can
 * navigate to it directly without paying.
 */
async function handleItn(
  req: Request,
  res: Response,
  store: DataStore,
  payfast: PayFastConfig,
  mailer: Mailer,
): Promise<void> {
  const body = (req.body ?? {}) as Record<string, string>;
  const rawBody = (req as RawBodyRequest).rawBody ?? '';
  const reference = body.m_payment_id;

  // Verification runs before the reply rather than after it. Answering 200
  // first would be faster, but it also tells PayFast the notification was
  // handled — so if our processing then failed, the payment would be lost
  // with no retry. PayFast re-sends on any non-200, and the handler is
  // idempotent, so a 500 here is a safe request to try again.
  try {
    if (!reference) {
      console.warn('[itn] Notification with no m_payment_id, ignoring.');
      res.status(200).send('OK');
      return;
    }

    const payment = await store.getPayment(reference);
    if (!payment) {
      // Not ours, or already pruned. Acknowledge so PayFast stops retrying.
      console.warn(`[itn] No local payment for reference ${reference}, ignoring.`);
      res.status(200).send('OK');
      return;
    }

    // Already settled. PayFast re-sends notifications, and re-processing would
    // double-count revenue and send a second receipt.
    if (payment.status === 'COMPLETE' && body.payment_status === 'COMPLETE') {
      res.status(200).send('OK');
      return;
    }

    const verdict = await verifyItn(payfast, {
      body,
      rawBody,
      sourceIp: req.ip ?? '',
      expectedAmountZAR: payment.amountZAR,
    });

    if (!verdict.valid) {
      // A failed check means the notification is not trustworthy — record why
      // for the dashboard, then acknowledge. Retrying would not change the
      // verdict, and a forged request must not be able to hold a retry slot.
      console.error(`[itn] Rejected notification for ${reference}: ${verdict.reason}`);
      await store.updatePayment(payment.id, {
        itnError: verdict.reason,
        itnReceivedAt: new Date().toISOString(),
      });
      res.status(200).send('OK');
      return;
    }

    const pfStatus = body.payment_status;
    const status =
      pfStatus === 'COMPLETE' ? 'COMPLETE' : pfStatus === 'CANCELLED' ? 'CANCELLED' : 'FAILED';

    const fee = parseMoney(body.amount_fee);

    await store.updatePayment(payment.id, {
      status,
      pfPaymentId: body.pf_payment_id,
      pfPaymentStatus: pfStatus,
      amountNetZAR: parseMoney(body.amount_net),
      // PayFast reports the fee as a negative number; store it as a cost.
      feeZAR: fee === undefined ? undefined : Math.abs(fee),
      itnError: undefined,
      itnReceivedAt: new Date().toISOString(),
    });

    if (status === 'COMPLETE') {
      if (payment.kind === 'TICKET' && payment.applicationId) {
        // A completed ticket advances the application and issues the pass.
        const application = await store.getApplication(payment.applicationId);
        if (application && application.status !== 'PAID') {
          const ticketCode = application.ticketCode ?? makeReference('TICKET');
          await store.updateApplication(application.id, {
            status: 'PAID',
            paymentId: payment.id,
            ticketCode,
          });
          sendInBackground(
            mailer,
            application.email,
            ticketConfirmed({
              contactName: application.contactName,
              businessName: application.businessName,
              ticketCode,
              amountZAR: payment.amountZAR,
              attendeeCount: application.attendeeCount || 1,
            }),
            'ticket-confirmed',
          );
        }
      } else if (payment.kind === 'DONATION') {
        sendInBackground(
          mailer,
          payment.email,
          donationReceipt({
            name: payment.name,
            amountZAR: payment.amountZAR,
            reference: payment.reference,
          }),
          'donation-receipt',
        );
      }
    }

    console.log(`[itn] ${reference} -> ${status} (PayFast ${pfStatus}).`);
    res.status(200).send('OK');
  } catch (err) {
    // Something genuinely broke on our side — a disk write, say. Ask PayFast
    // to try again rather than silently dropping a real payment.
    console.error(`[itn] Processing failed for ${reference ?? 'unknown'}:`, err);
    if (!res.headersSent) res.status(500).send('ERROR');
  }
}

function parseMoney(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : undefined;
}

async function buildStats(store: DataStore): Promise<DashboardStats> {
  const settings = await store.getSettings();
  const completed = await store.completedPayments();
  const tickets = completed.filter((p) => p.kind === 'TICKET');
  const donations = completed.filter((p) => p.kind === 'DONATION');

  const sum = (list: Payment[], pick: (p: Payment) => number | undefined) =>
    Math.round(list.reduce((total, p) => total + (pick(p) ?? 0), 0) * 100) / 100;

  const ticketsRevenueZAR = sum(tickets, (p) => p.amountZAR);
  const donationsRevenueZAR = sum(donations, (p) => p.amountZAR);
  const feesZAR = sum(completed, (p) => p.feeZAR);
  const totalRaisedZAR = Math.round((ticketsRevenueZAR + donationsRevenueZAR) * 100) / 100;

  return {
    ticketsSold: tickets.length,
    ticketsRevenueZAR,
    donationsCount: donations.length,
    donationsRevenueZAR,
    totalRaisedZAR,
    netRaisedZAR: Math.round((totalRaisedZAR - feesZAR) * 100) / 100,
    feesZAR,
    applications: await store.countApplicationsByStatus(),
    seatsRemaining: Math.max(0, settings.capacity - await store.countPaidSeats()),
    capacity: settings.capacity,
  };
}

// -------------------------------------------------------------------- middleware

/**
 * Admin gate. Compares a bearer token against ADMIN_TOKEN in constant time.
 * If no token is configured the admin API is closed entirely rather than
 * left open — an unset secret must never mean "allow everyone".
 */
function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = (process.env.ADMIN_TOKEN || '').trim();

  if (!expected) {
    res.status(503).json({
      success: false,
      error: 'The admin dashboard is disabled because ADMIN_TOKEN is not set on the server.',
    });
    return;
  }

  const ip = clientKey(req);
  if (isLockedOut(ip)) {
    res.status(429).json({
      success: false,
      error: 'Too many failed sign-in attempts. Try again in a few minutes.',
    });
    return;
  }

  const header = req.get('authorization') || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  // Compare digests rather than the raw strings. Hashing gives both sides a
  // fixed 32-byte length, so timingSafeEqual can never throw on a length
  // mismatch — padding the strings instead would compare characters against
  // bytes and blow up on any non-ASCII token, turning a 401 into a 500.
  if (!timingSafeCompare(provided, expected)) {
    recordAdminFailure(ip);
    res.status(401).json({ success: false, error: 'Invalid admin token.' });
    return;
  }

  clearAdminFailures(ip);
  next();
}

/**
 * Brute-force brake on the admin gate.
 *
 * Only failures are counted. The dashboard makes many authorised calls per
 * page, so limiting all admin traffic would throttle the actual admin long
 * before it inconvenienced anyone guessing. A correct token clears the tally.
 */
const ADMIN_MAX_FAILURES = 10;
const ADMIN_LOCKOUT_MS = 15 * 60_000;
const adminFailures = new Map<string, { count: number; until: number }>();

export function isLockedOut(ip: string): boolean {
  const entry = adminFailures.get(ip);
  if (!entry) return false;
  if (entry.until < Date.now()) {
    adminFailures.delete(ip);
    return false;
  }
  return entry.count >= ADMIN_MAX_FAILURES;
}

export function recordAdminFailure(ip: string): void {
  const now = Date.now();
  const entry = adminFailures.get(ip);

  if (!entry || entry.until < now) {
    adminFailures.set(ip, { count: 1, until: now + ADMIN_LOCKOUT_MS });
  } else {
    entry.count += 1;
    entry.until = now + ADMIN_LOCKOUT_MS;
  }

  if (adminFailures.size > 5000) {
    for (const [key, value] of adminFailures) if (value.until < now) adminFailures.delete(key);
  }
}

export function clearAdminFailures(ip: string): void {
  adminFailures.delete(ip);
}

/** Constant-time string comparison that is safe for any input length. */
export function timingSafeCompare(a: string, b: string): boolean {
  const digest = (value: string) => crypto.createHash('sha256').update(value, 'utf8').digest();
  return crypto.timingSafeEqual(digest(a), digest(b));
}

function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // HSTS, but only once the connection actually is HTTPS. Sending it over
  // plain HTTP is meaningless, and sending it in local development would pin
  // localhost to HTTPS in the developer's browser for a year — a confusing
  // failure to diagnose and awkward to undo.
  //
  // Two years with preload omitted deliberately: preload is a one-way door
  // that is slow and painful to reverse, and it should be a decision taken
  // for the domain rather than a side effect of a header default.
  if (req.secure || req.get('x-forwarded-proto') === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }

  next();
}

/**
 * Best-effort caller identity, for throttling only.
 *
 * req.ip is the right answer for the ITN source-IP check, which must not be
 * spoofable. It is the wrong answer for rate limiting when a second proxy sits
 * in front — every visitor then shares that proxy's address and one shared
 * bucket, so a handful of unrelated people filling in the form in the same
 * minute would lock the rest out.
 *
 * The leftmost X-Forwarded-For entry is the original client. It is client-set
 * and therefore forgeable, which is acceptable here and nowhere else: forging
 * it only lets someone dodge their own throttle, which is true of any IP-based
 * limit, and the alternative punishes real users. Never use this for auth.
 */
export function clientKey(req: Request): string {
  const forwarded = req.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.ip ?? 'unknown';
}

/** Small fixed-window limiter, enough to blunt casual abuse of the public forms. */
function rateLimit(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = clientKey(req);
    const entry = hits.get(key);

    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      // Opportunistic sweep so the map cannot grow without bound.
      if (hits.size > 5000) {
        for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
      }
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > max) {
      res.status(429).json({ success: false, error: 'Too many requests. Please wait a moment and try again.' });
      return;
    }
    next();
  };
}

function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[error]', err);
  if (res.headersSent) return;
  // Never leak a stack trace to the client.
  res.status(500).json({ success: false, error: 'Something went wrong on our side. Please try again.' });
}

function csvCell(value: string): string {
  const v = String(value ?? '');
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
