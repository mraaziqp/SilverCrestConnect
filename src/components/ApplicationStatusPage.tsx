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
import { ArrowRight, CheckCircle2, Clock, Loader2, Search, XCircle } from 'lucide-react';
import { Monogram, Button, ButtonLink, Card, FieldError } from './Brand';
import { EVENT } from '../config/event';
import { api, ApiRequestError, formatZAR } from '../lib/api';
import { redirectToPayFast } from '../lib/payfast';
import type { ApplicationStatus, CheckoutResponse } from '../types';

interface StatusResponse {
  success: true;
  application: {
    reference: string;
    businessName: string;
    status: ApplicationStatus;
    ticketCode?: string;
    createdAt: string;
  };
}

/** Copy for each funnel state, keyed so the page never shows a raw enum. */
const STATE: Record<
  ApplicationStatus,
  { title: string; body: (business: string) => string; tone: 'wait' | 'go' | 'done' | 'stop' }
> = {
  PENDING_REVIEW: {
    title: 'Under review',
    tone: 'wait',
    body: (b) =>
      `We have ${b}'s application and are running the verification check. You will get an email with a payment link as soon as it is approved.`,
  },
  APPROVED: {
    title: 'Approved — secure your seat',
    tone: 'go',
    body: (b) =>
      `${b} has been approved. Complete the attendance fee below to confirm your seat. Your seat is not held until payment clears.`,
  },
  PAID: {
    title: 'Your seat is confirmed',
    tone: 'done',
    body: (b) => `${b} is confirmed for ${EVENT.fullName}. Bring your ticket code to registration.`,
  },
  WAITLISTED: {
    title: "You're on the waiting list",
    tone: 'wait',
    body: (b) =>
      `${b} has been added to the waiting list. The room holds ${EVENT.capacity}; if a seat opens we will email you a payment link straight away.`,
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await api<StatusResponse>(
        `/api/applications/${encodeURIComponent(reference)}`,
      );
      setData(result.application);
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
      // The browser navigates away, so `paying` intentionally stays true.
    } catch (err) {
      setPayError(
        err instanceof ApiRequestError ? err.message : 'Could not start the payment. Please try again.',
      );
      setPaying(false);
    }
  };

  if (loadError) {
    return (
      <Shell>
        <XCircle className="w-11 h-11 text-red-400 mx-auto" aria-hidden="true" />
        <h1 className="mt-6 font-display text-2xl font-bold text-bone">Reference not found</h1>
        <p className="mt-4 text-[15px] text-muted leading-relaxed">{loadError}</p>
        <ReferenceLookup />
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <Loader2 className="w-11 h-11 text-gold animate-spin mx-auto" aria-hidden="true" />
        <p className="mt-6 text-[15px] text-muted">Looking up your application…</p>
      </Shell>
    );
  }

  const state = STATE[data.status];
  const Icon =
    state.tone === 'done' ? CheckCircle2 : state.tone === 'stop' ? XCircle : state.tone === 'go' ? CheckCircle2 : Clock;

  return (
    <Shell>
      <Icon
        className={`w-11 h-11 mx-auto ${state.tone === 'stop' ? 'text-red-400' : 'text-gold'}`}
        aria-hidden="true"
      />
      <h1 className="mt-6 font-display text-2xl sm:text-3xl font-bold text-bone">{state.title}</h1>
      <p className="mt-4 text-[15px] text-muted leading-relaxed">{state.body(data.businessName)}</p>

      {/* Reference / ticket panel */}
      <div className="mt-8 rounded-sm border border-gold/30 bg-gold/[0.06] px-6 py-5">
        <p className="text-[10px] uppercase tracking-brand text-gold font-semibold">
          {data.ticketCode ? 'Your ticket' : 'Your reference'}
        </p>
        <p className="mt-2 font-mono text-lg text-bone tracking-[0.15em]">
          {data.ticketCode ?? data.reference}
        </p>
        {data.ticketCode && (
          <p className="mt-3 text-[12px] text-muted">Show this at registration.</p>
        )}
      </div>

      {data.status === 'APPROVED' && (
        <div className="mt-8">
          <Button size="lg" className="w-full" onClick={pay} disabled={paying}>
            {paying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Redirecting to PayFast…
              </>
            ) : (
              <>
                Pay {formatZAR(EVENT.ticketPriceZAR)} &amp; confirm
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
          <FieldError message={payError ?? undefined} />
          <p className="mt-4 text-[12px] text-muted/70 leading-relaxed">
            Secured by PayFast. Card details are entered on PayFast's page and never touch this site.
          </p>
        </div>
      )}

      {data.status === 'PAID' && (
        <p className="mt-8 text-[13px] text-muted/80">
          {EVENT.dateLabel} · {EVENT.timeLabel} · {EVENT.venueCity}
        </p>
      )}

      <div className="mt-10">
        <ButtonLink href="/" variant="outline">
          Back to the event
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

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main className="min-h-[100svh] flex items-center justify-center px-5 py-20">
    <div className="w-full max-w-lg text-center">
      <a href="/" aria-label={`${EVENT.fullName} home`} className="inline-block mb-10">
        <Monogram size={48} />
      </a>
      <Card className="p-8 sm:p-10">{children}</Card>
    </div>
  </main>
);
