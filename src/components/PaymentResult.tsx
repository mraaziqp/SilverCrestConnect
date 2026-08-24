/**
 * Landing pages for PayFast's return_url and cancel_url.
 *
 * The browser coming back from PayFast is NOT proof of payment — the user can
 * hit this URL directly, and PayFast redirects before the ITN callback is
 * guaranteed to have arrived. So the page polls our own record and only claims
 * success once the server has verified the notification.
 */

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';
import { Monogram, ButtonLink } from './Brand';
import { EVENT } from '../config/event';
import { api, formatZAR } from '../lib/api';
import type { PaymentStatus, PaymentKind } from '../types';

interface StatusResponse {
  success: true;
  payment: {
    reference: string;
    kind: PaymentKind;
    amountZAR: number;
    status: PaymentStatus;
    createdAt: string;
  };
  ticketCode?: string;
  businessName?: string;
}

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 45_000;

export const PaymentReturn: React.FC = () => {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const startedAt = useRef(Date.now());

  // PayFast echoes m_payment_id back on the return URL.
  const reference = new URLSearchParams(window.location.search).get('m_payment_id');

  useEffect(() => {
    if (!reference) {
      setError('No payment reference was supplied.');
      return;
    }

    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      if (cancelled) return;
      try {
        const result = await api<StatusResponse>(`/api/payments/${encodeURIComponent(reference)}/status`);
        if (cancelled) return;
        setData(result);

        // Keep polling only while the payment is still pending.
        if (result.payment.status === 'PENDING') {
          if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
            setTimedOut(true);
            return;
          }
          timer = window.setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) setError('We could not look up that payment.');
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [reference]);

  if (error) {
    return (
      <ResultShell
        icon={<XCircle className="w-12 h-12 text-red-400" />}
        title="Something went wrong"
        body={error}
      />
    );
  }

  if (!data) {
    return (
      <ResultShell
        icon={<Loader2 className="w-12 h-12 text-gold animate-spin" />}
        title="Checking your payment…"
        body="One moment while we confirm this with PayFast."
      />
    );
  }

  const { payment, ticketCode, businessName } = data;

  if (payment.status === 'COMPLETE') {
    const isTicket = payment.kind === 'TICKET';
    return (
      <ResultShell
        icon={<CheckCircle2 className="w-12 h-12 text-gold" />}
        title={isTicket ? 'Your seat is confirmed' : 'Thank you for your support'}
        body={
          isTicket
            ? `${businessName ?? 'Your business'} is confirmed for ${EVENT.fullName} on ${EVENT.dateLabel}. A confirmation email with your digital ticket is on its way.`
            : `Your donation of ${formatZAR(payment.amountZAR)} goes directly towards the ${EVENT.causeShort}. Thank you.`
        }
      >
        <div className="mt-8 rounded-sm border border-gold/30 bg-gold/[0.06] px-6 py-5 text-center">
          <p className="text-[10px] uppercase tracking-brand text-gold font-semibold">
            {isTicket && ticketCode ? 'Your ticket code' : 'Payment reference'}
          </p>
          <p className="mt-2 font-mono text-lg text-bone tracking-[0.15em]">
            {isTicket && ticketCode ? ticketCode : payment.reference}
          </p>
          <p className="mt-3 text-[12px] text-muted">
            {formatZAR(payment.amountZAR, true)} received
          </p>
        </div>
      </ResultShell>
    );
  }

  if (payment.status === 'PENDING') {
    return (
      <ResultShell
        icon={
          timedOut ? (
            <Clock className="w-12 h-12 text-gold" />
          ) : (
            <Loader2 className="w-12 h-12 text-gold animate-spin" />
          )
        }
        title={timedOut ? 'Still processing' : 'Confirming your payment…'}
        body={
          timedOut
            ? `PayFast has not confirmed this payment yet. Some methods, such as EFT, settle later. We will email you as soon as it clears — your reference is ${payment.reference}.`
            : 'PayFast is confirming the transaction with us. This usually takes a few seconds.'
        }
      />
    );
  }

  return (
    <ResultShell
      icon={<XCircle className="w-12 h-12 text-red-400" />}
      title={payment.status === 'CANCELLED' ? 'Payment cancelled' : 'Payment did not go through'}
      body={`No money has been taken. You are welcome to try again — your reference was ${payment.reference}.`}
    />
  );
};

export const PaymentCancelled: React.FC = () => (
  <ResultShell
    icon={<XCircle className="w-12 h-12 text-muted" />}
    title="Payment cancelled"
    body="You cancelled before completing the payment, so nothing has been charged. Your application is still on file."
  />
);

const ResultShell: React.FC<{
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}> = ({ icon, title, body, children }) => (
  <main className="min-h-[100svh] flex items-center justify-center px-5 py-20">
    <div className="w-full max-w-lg text-center">
      <Monogram size={48} className="mx-auto mb-10" />
      <div className="flex justify-center">{icon}</div>
      <h1 className="mt-7 font-display text-2xl sm:text-3xl font-bold text-bone">{title}</h1>
      <p className="mt-4 text-[15px] text-muted leading-relaxed">{body}</p>
      {children}
      <div className="mt-10">
        <ButtonLink href="/" variant="outline">
          Back to the event
        </ButtonLink>
      </div>
    </div>
  </main>
);
