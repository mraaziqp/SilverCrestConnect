/**
 * Applicant-facing status page at /pay/:reference.
 *
 * This is where the approval email points. It serves two jobs at once:
 * it tells an applicant where they stand in the funnel, and — once they are
 * approved — it is the button that starts the PayFast checkout.
 *
 * A reference is not a secret, so this deliberately shows only what the
 * applicant already knows: their business name and their status. Review notes
 * and contact details stay in the dashboard.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, Loader2, Search, XCircle, Calendar, MapPin } from 'lucide-react';
import { Monogram, Button, ButtonLink, Card, FieldError } from './Brand';
import { EVENT } from '../config/event';
import { api, ApiRequestError, formatZAR } from '../lib/api';
import { redirectToPayFast } from '../lib/payfast';
import type { ApplicationStatus, CheckoutResponse, EventSettings, ProgrammeItem } from '../types';

interface StatusResponse {
  success: true;
  application: {
    reference: string;
    businessName: string;
    status: ApplicationStatus;
    attendeeCount?: 1 | 2;
    totalPriceZAR?: number;
    rep2Name?: string;
    ticketCode?: string;
    createdAt: string;
  };
  event?: EventSettings;
  programme?: ProgrammeItem[];
  paymentsOpen?: boolean;
}

/** Copy for each funnel state, keyed so the page never shows a raw enum. */
const STATE: Record<
  ApplicationStatus | 'APPROVED_AWAITING_PAYMENT',
  { title: string; body: (business: string, eventName: string) => string; tone: 'wait' | 'go' | 'done' | 'stop' }
> = {
  PENDING_REVIEW: {
    title: 'Under review',
    tone: 'wait',
    body: (b) =>
      `We have ${b}'s application and are running the verification check. You will get an email with a payment link as soon as it is approved.`,
  },
  APPROVED: {
    title: 'Approved: Secure Your Seat',
    tone: 'go',
    body: (b) =>
      `${b} has been approved. Complete the attendance fee below to confirm your seat. Your seat is not held until payment clears.`,
  },
  // Same status, but with nothing to complete yet. Kept as its own entry rather
  // than patched inline, so the heading and the panel below it cannot drift
  // apart and tell the applicant two different things.
  APPROVED_AWAITING_PAYMENT: {
    title: 'Approved',
    tone: 'go',
    body: (b) =>
      `${b} has been approved and your place is recorded. Payment is not open yet — we will email you a secure link as soon as it is.`,
  },
  PAID: {
    title: 'Your seat is confirmed',
    tone: 'done',
    body: (b, ev) => `${b} is confirmed for ${ev}. Bring your ticket code to registration.`,
  },
  WAITLISTED: {
    title: "You're on the waiting list",
    tone: 'wait',
    body: (b) =>
      `${b} has been added to the waiting list. If a seat opens we will email you a payment link straight away.`,
  },
  REJECTED: {
    title: 'Application not successful',
    tone: 'stop',
    body: () =>
      `Unfortunately this application did not meet the criteria for this event. If you think that is a mistake, reply to our email and we will take another look.`,
  },
};

export const ApplicationStatusPage: React.FC<{ reference: string }> = ({ reference }) => {
  const [data, setData] = useState<StatusResponse['application'] | null>(null);
  const [eventData, setEventData] = useState<EventSettings | null>(null);
  const [programme, setProgramme] = useState<ProgrammeItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [paymentsOpen, setPaymentsOpen] = useState(true);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await api<StatusResponse>(
        `/api/applications/${encodeURIComponent(reference)}`,
      );
      setData(result.application);
      if (result.event) setEventData(result.event);
      if (result.programme) setProgramme(result.programme);
      setPaymentsOpen(result.paymentsOpen !== false);
    } catch (err) {
      setLoadError(
        err instanceof ApiRequestError && err.status === 404
          ? 'We could not find an application with that reference. Check the code from your email.'
          : 'We could not load your application just now. Please try again shortly.',
      );
    }
  }, [reference]);

  useEffect(() => {
    load();
  }, [load]);

  const pay = async () => {
    setPaying(true);
    setPayError(null);
    try {
      const result = await api<CheckoutResponse>('/api/checkout/ticket', {
        method: 'POST',
        body: { reference },
      });
      redirectToPayFast(result);
    } catch (err) {
      setPayError(
        err instanceof ApiRequestError ? err.message : 'Could not start the payment. Please try again.',
      );
      setPaying(false);
    }
  };

  const eventName = eventData?.fullName || EVENT.fullName;
  const dateLabel = eventData?.dateLabel || EVENT.dateLabel;
  const timeLabel = eventData?.timeLabel || EVENT.timeLabel;
  const venueLocation = eventData?.venueCity || eventData?.venue || EVENT.venueCity;
  const ticketPrice = eventData?.ticketPriceZAR ?? EVENT.ticketPriceZAR;

  if (loadError) {
    return (
      <Shell customLogoUrl={eventData?.customLogoUrl}>
        <XCircle className="w-11 h-11 text-red-400 mx-auto" aria-hidden="true" />
        <h1 className="mt-6 font-display text-2xl font-bold text-bone">Reference not found</h1>
        <p className="mt-4 text-[15px] text-muted leading-relaxed">{loadError}</p>
        <ReferenceLookup />
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell customLogoUrl={eventData?.customLogoUrl}>
        <Loader2 className="w-11 h-11 text-gold animate-spin mx-auto" aria-hidden="true" />
        <p className="mt-6 text-[15px] text-muted">Looking up your application…</p>
      </Shell>
    );
  }

  const state =
    data.status === 'APPROVED' && !paymentsOpen ? STATE.APPROVED_AWAITING_PAYMENT : STATE[data.status];
  const Icon =
    state.tone === 'done' ? CheckCircle2 : state.tone === 'stop' ? XCircle : state.tone === 'go' ? CheckCircle2 : Clock;

  return (
    <Shell customLogoUrl={eventData?.customLogoUrl}>
      <Icon
        className={`w-11 h-11 mx-auto ${state.tone === 'stop' ? 'text-red-400' : 'text-gold'}`}
        aria-hidden="true"
      />
      <h1 className="mt-6 font-display text-2xl sm:text-3xl font-bold text-bone">{state.title}</h1>
      <p className="mt-4 text-[15px] text-muted leading-relaxed">{state.body(data.businessName, eventName)}</p>

      {/* Reference / ticket panel */}
      <div className="mt-8 rounded-sm border border-gold/30 bg-gold/[0.06] px-6 py-5">
        <p className="text-[10px] uppercase tracking-brand text-gold font-semibold">
          {data.ticketCode ? 'Your digital ticket' : 'Your reference'}
        </p>
        <p className="mt-2 font-mono text-lg text-bone tracking-[0.15em]">
          {data.ticketCode ?? data.reference}
        </p>
        {data.ticketCode && (
          <p className="mt-3 text-[12px] text-muted">Show this code at event registration.</p>
        )}
      </div>

      {data.status === 'APPROVED' && (
        <div className="mt-8">
          {data.attendeeCount === 2 && (
            <div className="mb-4 p-3 rounded bg-gold/10 border border-gold/25 text-xs text-bone">
              <span className="font-semibold text-gold">2 Approved Attendees:</span>{' '}
              {data.businessName} (Includes light breakfast for both attendees)
            </div>
          )}
          {paymentsOpen ? (
            <>
              <Button size="lg" className="w-full" onClick={pay} disabled={paying}>
                {paying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Redirecting to PayFast…
                  </>
                ) : (
                  <>
                    Pay {formatZAR(data.totalPriceZAR || (data.attendeeCount === 2 ? ticketPrice * 2 : ticketPrice))} &amp; Confirm Seat
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
              <FieldError message={payError ?? undefined} />
              <p className="mt-4 text-[12px] text-muted/70 leading-relaxed">
                Secured by PayFast. Card details are entered on PayFast's page and never touch this site.
              </p>
            </>
          ) : (
            /* Approved, but the site cannot take money yet. Showing a disabled
               button would read as a fault on their side, so this says what is
               actually happening and that their place is not at risk. */
            <div className="rounded-sm border border-gold/30 bg-gold/[0.06] px-5 py-4">
              <p className="text-sm font-semibold text-gold">Payment is not open yet</p>
              <p className="mt-2 text-[13px] text-muted leading-relaxed">
                Your application is approved and your reference is recorded. We are
                finalising payment now and will email you a secure link as soon as it
                is ready — there is nothing you need to do in the meantime.
              </p>
              <p className="mt-3 text-[12px] text-muted/70">
                Amount to expect:{' '}
                <span className="text-bone font-semibold">
                  {formatZAR(data.totalPriceZAR || (data.attendeeCount === 2 ? ticketPrice * 2 : ticketPrice))}
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {data.status === 'PAID' && (
        <>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 text-[13px] text-muted/80">
            <span className="inline-flex items-center gap-1.5 text-bone">
              <Calendar className="w-4 h-4 text-gold" /> {dateLabel} · {timeLabel}
            </span>
            <span className="hidden sm:inline text-white/20">|</span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-gold" /> {venueLocation}
            </span>
          </div>

          {/* Exclusive Programme Schedule for Paid Attendees */}
          {programme && programme.length > 0 && (
            <div className="mt-10 text-left border-t border-white/10 pt-8">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-lg font-bold text-bone">Event Programme</h3>
                <span className="text-[10px] uppercase tracking-brand text-gold font-semibold bg-gold/10 px-2 py-0.5 rounded-sm border border-gold/30">
                  Confirmed Attendee
                </span>
              </div>
              <ul className="divide-y divide-white/5 border border-white/8 rounded-lg overflow-hidden">
                {programme.map((item, idx) => (
                  <li key={item.id || idx} className="p-4 bg-ink/60 hover:bg-white/[0.02]">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-xs text-gold font-medium">{item.time}</span>
                      <span className="text-[10px] text-muted/60 uppercase tracking-wider">{item.duration}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-bone">{item.title}</p>
                    {item.detail && <p className="mt-0.5 text-xs text-muted leading-relaxed">{item.detail}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="mt-10">
        <ButtonLink href="/" variant="outline">
          Back to home
        </ButtonLink>
      </div>
    </Shell>
  );
};

/** Lets someone who mistyped a reference try another without going back. */
const ReferenceLookup: React.FC = () => {
  const [value, setValue] = useState('');

  return (
    <form
      className="mt-8"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim().toUpperCase();
        if (trimmed) window.location.href = `/pay/${encodeURIComponent(trimmed)}`;
      }}
    >
      <label htmlFor="lookup" className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 text-left">
        Try another reference
      </label>
      <div className="flex gap-2">
        <input
          id="lookup"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="SCC26-XXXXXX"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 min-w-0 rounded-sm bg-black/50 border border-white/12 px-4 py-3 text-sm text-bone placeholder:text-muted/40 font-mono uppercase tracking-wider focus:border-gold focus:outline-none transition-colors"
        />
        <Button type="submit" aria-label="Look up reference">
          <Search className="w-4 h-4" />
        </Button>
      </div>
    </form>
  );
};

const Shell: React.FC<{ children: React.ReactNode; customLogoUrl?: string }> = ({
  children,
  customLogoUrl,
}) => (
  <main className="min-h-[100svh] flex items-center justify-center px-5 py-20">
    <div className="w-full max-w-xl text-center">
      <a href="/" aria-label={`${EVENT.fullName} home`} className="inline-block mb-10">
        <Monogram size={48} customLogoUrl={customLogoUrl} />
      </a>
      <Card className="p-8 sm:p-10">{children}</Card>
    </div>
  </main>
);
