/**
 * Tickets & checkout.
 *
 * The proposal gates attendance behind a vetting step, so this section carries
 * two paths rather than a naked "buy" button:
 *   - Apply for a seat (free, opens the application form)
 *   - Already applied? Look up your reference to see status and pay
 */

import React, { useState } from 'react';
import { ArrowRight, Check, HelpCircle, ShieldCheck, Ticket, Users } from 'lucide-react';
import { Section, SectionHeading, Card, Button, FieldError } from './Brand';
import { ApplicationForm } from './ApplicationForm';
import { EVENT, TICKET_INCLUDES, FAQS } from '../config/event';
import { formatZAR } from '../lib/api';
import type { EventSettings } from '../types';

interface TicketsProps {
  seatsRemaining: number | null;
  event?: Partial<EventSettings>;
}

export const Tickets: React.FC<TicketsProps> = ({ seatsRemaining, event }) => {
  const [formOpen, setFormOpen] = useState(false);
  const soldOut = seatsRemaining !== null && seatsRemaining <= 0;

  const ticketPrice = event?.ticketPriceZAR ?? EVENT.ticketPriceZAR;
  const capacity = event?.capacity ?? EVENT.capacity;

  // A seat is a person, not a business: a two-representative booking takes two.
  // Below five left the count is worth calling out; above that it is just a fact.
  const seatsScarce = seatsRemaining !== null && seatsRemaining > 0 && seatsRemaining <= 5;

  return (
    <Section id="tickets" className="border-t border-white/5">
      <SectionHeading
        eyebrow="Curated Attendance"
        title={
          <>
            Apply to <span className="text-gold">Attend</span>
          </>
        }
        lead="Connect is a curated event aiming for 1–2 businesses per category to create meaningful networking. Applications are reviewed first; payment is only requested once approved."
      />

      <div className="mt-14 grid gap-8 lg:grid-cols-[1.15fr_1fr] items-start">
        {/* Ticket card */}
        <Card featured className="p-8 sm:p-10">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <span className="inline-block px-2.5 py-1 rounded bg-gold/15 border border-gold/30 text-[10px] uppercase tracking-brand text-gold font-bold mb-2">
                1–2 Per Category · Curated Access
              </span>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-bone">
                Standard Attendance
              </h3>
              <p className="mt-1 text-xs text-muted">Includes light breakfast & morning refreshments</p>
            </div>
            <div className="text-right">
              <p className="font-display text-4xl sm:text-5xl font-bold text-gold leading-none">
                {formatZAR(ticketPrice)}
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-muted/70">
                per person
              </p>
              {/* Null means the count has not loaded yet. Rendering nothing is
                  right: "0 seats remaining" during a fetch would read as sold
                  out and turn people away. */}
              {seatsRemaining !== null && !soldOut && (
                <p
                  className={`mt-3 text-[12px] font-semibold ${
                    seatsScarce ? 'text-gold' : 'text-muted'
                  }`}
                >
                  <span className="tabular-nums">{seatsRemaining}</span> of{' '}
                  <span className="tabular-nums">{capacity}</span> seats remaining
                </p>
              )}
            </div>
          </div>

          <ul className="mt-8 space-y-3">
            {TICKET_INCLUDES.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[14px] text-muted">
                <Check className="w-4 h-4 text-gold shrink-0 mt-0.5" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {/* Second representative box */}
          <div className="mt-8 p-4 rounded-lg bg-ink-raised border border-gold/20">
            <div className="flex items-start gap-3">
              <Users className="w-4 h-4 text-gold shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs uppercase tracking-brand text-gold font-bold">
                  Want to bring someone from your business?
                </h4>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  You may apply for a second representative. Additional representatives are subject to approval and availability and are charged at {formatZAR(ticketPrice)} per person ({formatZAR(ticketPrice * 2)} total for 2 attendees, including light breakfast).
                </p>
              </div>
            </div>
          </div>

          <div className="mt-9 pt-8 border-t border-white/8">
            {soldOut ? (
              <div className="text-center">
                <p className="text-sm font-semibold text-bone">All seats have been taken.</p>
                <p className="mt-2 text-[13px] text-muted">
                  Apply anyway and we will place your business on the priority waiting list.
                </p>
                <Button size="lg" variant="outline" className="mt-6 w-full" onClick={() => setFormOpen(true)}>
                  Join the Waiting List
                </Button>
              </div>
            ) : (
              <>
                <Button size="lg" className="w-full" onClick={() => setFormOpen(true)}>
                  <Ticket className="w-4 h-4" />
                  APPLY TO ATTEND — {formatZAR(ticketPrice)}
                </Button>
                <p className="mt-4 text-center text-[12px] text-muted/80 leading-relaxed">
                  Submitting is free. We review your application to maintain a balanced room, then email your private payment link.
                </p>
              </>
            )}
          </div>
        </Card>

        {/* Pay / status panel & FAQ */}
        <div className="space-y-6">
          <ReferenceLookup />

          {/* FAQ Box */}
          <Card className="p-7">
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle className="w-4 h-4 text-gold" />
              <h4 className="text-xs uppercase tracking-brand text-gold font-bold">
                Frequently Asked Questions
              </h4>
            </div>
            <div className="space-y-4">
              {FAQS.map((faq, idx) => (
                <div key={idx} className="border-b border-white/8 pb-3 last:border-none last:pb-0">
                  <p className="text-xs font-semibold text-bone">{faq.question}</p>
                  <p className="mt-1 text-[12.5px] text-muted leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-7">
            <ShieldCheck className="w-5 h-5 text-gold" aria-hidden="true" />
            <h4 className="mt-4 text-sm font-semibold text-bone">Secure payments by PayFast</h4>
            <p className="mt-2.5 text-[13px] text-muted leading-relaxed">
              Card and Instant EFT payments are processed securely by PayFast. Your seat is confirmed immediately once payment clears.
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
