/**
 * Tickets & checkout.
 *
 * The proposal gates attendance behind a vetting step, so this section carries
 * two paths rather than a naked "buy" button:
 *   - Apply for a seat (free, opens the application form)
 *   - Already applied? Look up your reference to see status and pay
 */

import React, { useState } from 'react';
import { ArrowRight, Check, ShieldCheck, Ticket } from 'lucide-react';
import { Section, SectionHeading, Card, Button, FieldError } from './Brand';
import { ApplicationForm } from './ApplicationForm';
import { EVENT } from '../config/event';
import { formatZAR } from '../lib/api';
import type { EventSettings } from '../types';

const INCLUDES = [
  'Full four-hour programme access',
  'Four expert keynote sessions',
  'Two-minute SME Spotlight elevator pitch',
  'Vendor stall & floor browsing access',
  'Branded lanyard, badge & executive pen',
  'Morning refreshments and networking access',
];

interface TicketsProps {
  seatsRemaining: number | null;
  event?: Partial<EventSettings>;
}

export const Tickets: React.FC<TicketsProps> = ({ seatsRemaining, event }) => {
  const [formOpen, setFormOpen] = useState(false);
  const soldOut = seatsRemaining !== null && seatsRemaining <= 0;

  const ticketPrice = event?.ticketPriceZAR ?? EVENT.ticketPriceZAR;
  const causeShort = event?.causeShort || EVENT.causeShort;

  return (
    <Section id="tickets" className="border-t border-white/5">
      <SectionHeading
        eyebrow="Tickets"
        title={
          <>
            Claim your <span className="text-gold">seat</span>
          </>
        }
        lead={`Limited seating available. All ticket sales directly support the ${causeShort}.`}
      />

      <div className="mt-14 grid gap-6 lg:grid-cols-[1.15fr_1fr] items-start">
        {/* Ticket card */}
        <Card featured className="p-8 sm:p-10">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <p className="text-[10px] uppercase tracking-brand text-gold font-semibold">
                SME Attendance
              </p>
              <h3 className="mt-3 font-display text-2xl sm:text-3xl font-bold text-bone">
                Standard Ticket
              </h3>
            </div>
            <div className="text-right">
              <p className="font-display text-4xl sm:text-5xl font-bold text-gold leading-none">
                {formatZAR(ticketPrice)}
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-muted/70">
                per business
              </p>
            </div>
          </div>

          <ul className="mt-8 space-y-3">
            {INCLUDES.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[14px] text-muted">
                <Check className="w-4 h-4 text-gold shrink-0 mt-0.5" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-9 pt-8 border-t border-white/8">
            {soldOut ? (
              <div className="text-center">
                <p className="text-sm font-semibold text-bone">All seats have been taken.</p>
                <p className="mt-2 text-[13px] text-muted">
                  Apply anyway and we will add you to the waiting list.
                </p>
                <Button size="lg" variant="outline" className="mt-6 w-full" onClick={() => setFormOpen(true)}>
                  Join the waiting list
                </Button>
              </div>
            ) : (
              <>
                <Button size="lg" className="w-full" onClick={() => setFormOpen(true)}>
                  <Ticket className="w-4 h-4" />
                  Apply for a seat
                </Button>
                <p className="mt-4 text-center text-[12px] text-muted/80 leading-relaxed">
                  Applying is free. We verify your business, then email a secure payment link.
                </p>
              </>
            )}
          </div>
        </Card>

        {/* Pay / status panel */}
        <div className="space-y-6">
          <ReferenceLookup />

          <Card className="p-7">
            <ShieldCheck className="w-5 h-5 text-gold" aria-hidden="true" />
            <h4 className="mt-4 text-sm font-semibold text-bone">Secure payments by PayFast</h4>
            <p className="mt-2.5 text-[13px] text-muted leading-relaxed">
              Card and EFT payments are processed by PayFast, a South African registered payment
              gateway. Your card details are entered on PayFast's own secure page and are never
              seen or stored by this site.
            </p>
          </Card>
        </div>
      </div>

      <ApplicationForm open={formOpen} onClose={() => setFormOpen(false)} />
    </Section>
  );
};

/**
 * Reference lookup for SMEs who already applied.
 *
 * Sends them to /pay/:reference rather than starting a checkout inline: that
 * page handles every funnel state, so someone still under review gets a clear
 * "we're reviewing it" instead of a bare error.
 */
const ReferenceLookup: React.FC = () => {
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = reference.trim().toUpperCase();
    if (!trimmed) {
      setError('Enter the reference from your email.');
      return;
    }
    window.location.href = `/pay/${encodeURIComponent(trimmed)}`;
  };

  return (
    <Card className="p-7">
      <p className="text-[10px] uppercase tracking-brand text-gold font-semibold">
        Already applied?
      </p>
      <h4 className="mt-3 text-base font-semibold text-bone">Check your status or pay</h4>
      <p className="mt-2 text-[13px] text-muted leading-relaxed">
        Enter the reference from your email to see where your application stands, and to pay the{' '}
        {formatZAR(EVENT.ticketPriceZAR)} fee once approved.
      </p>

      <form onSubmit={submit} className="mt-5" noValidate>
        <label htmlFor="ticket-reference" className="sr-only">
          Application reference
        </label>
        <input
          id="ticket-reference"
          value={reference}
          onChange={(e) => {
            setReference(e.target.value);
            if (error) setError(null);
          }}
          placeholder="SCC26-XXXXXX"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          className="w-full rounded-sm bg-black/50 border border-white/12 px-4 py-3 text-sm text-bone placeholder:text-muted/40 font-mono uppercase tracking-wider focus:border-gold focus:outline-none transition-colors"
        />
        <FieldError message={error ?? undefined} />

        <Button type="submit" className="w-full mt-4">
          Continue
          <ArrowRight className="w-4 h-4" />
        </Button>
      </form>
    </Card>
  );
};
