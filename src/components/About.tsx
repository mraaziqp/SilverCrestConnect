/**
 * About the event and the cause.
 *
 * The brief asked for two feature boxes — networking/growth and community
 * impact — sitting under a short mission statement. The four proposal pillars
 * fold into those two boxes so the section stays tight.
 */

import React from 'react';
import { Handshake, HeartHandshake, Lightbulb, TrendingUp } from 'lucide-react';
import { Section, SectionHeading, Card } from './Brand';
import { EVENT, PILLARS } from '../config/event';
import { formatZAR } from '../lib/api';

const PILLAR_ICONS = {
  connect: Handshake,
  learn: Lightbulb,
  grow: TrendingUp,
  impact: HeartHandshake,
} as const;

export const About: React.FC = () => (
  <Section id="about" className="border-t border-white/5">
    <SectionHeading
      eyebrow="About the Event"
      title={
        <>
          A room built for <span className="text-gold">real business</span>,
          <br className="hidden sm:block" /> funding real community work.
        </>
      }
      lead={`Silver Crest Connect is an exclusive half-day showcase bringing together ${EVENT.capacityMin} to ${EVENT.capacityMax} vetted SME founders for high-intent B2B networking. Every seat sold funds the ${EVENT.causeShort} — 100% of attendance proceeds go straight to the cause.`}
    />

    {/* The two headline boxes the brief called for. */}
    <div className="mt-16 grid gap-6 md:grid-cols-2">
      <Card className="p-8 sm:p-10">
        <Handshake className="w-7 h-7 text-gold" aria-hidden="true" />
        <h3 className="mt-6 font-display text-xl sm:text-2xl font-bold text-bone">
          Networking &amp; Growth
        </h3>
        <p className="mt-4 text-[15px] text-muted leading-relaxed">
          Curated introductions between local founders, four expert keynotes, and a dedicated
          SME Spotlight where every business gets the floor for a two-minute elevator pitch.
          No crowd to get lost in — just the right {EVENT.capacityMax} people.
        </p>
      </Card>

      <Card className="p-8 sm:p-10" featured>
        <HeartHandshake className="w-7 h-7 text-gold" aria-hidden="true" />
        <h3 className="mt-6 font-display text-xl sm:text-2xl font-bold text-bone">
          Community Impact
        </h3>
        <p className="mt-4 text-[15px] text-muted leading-relaxed">
          Every {formatZAR(EVENT.ticketPriceZAR)} ticket, every stand contribution and every online
          donation is funnelled directly into supplies for the {EVENT.causeShort}. Nothing is held
          back for overheads.
        </p>
      </Card>
    </div>

    {/* Supporting pillars, kept compact underneath. */}
    <div className="mt-8 grid gap-px bg-white/5 rounded-lg overflow-hidden sm:grid-cols-2 lg:grid-cols-4">
      {PILLARS.map((pillar) => {
        const Icon = PILLAR_ICONS[pillar.id];
        return (
          <div key={pillar.id} className="bg-ink-raised p-6">
            <Icon className="w-5 h-5 text-gold" aria-hidden="true" />
            <h4 className="mt-4 text-sm font-semibold text-bone uppercase tracking-[0.12em]">
              {pillar.title}
            </h4>
            <p className="mt-2.5 text-[13px] text-muted leading-relaxed">{pillar.body}</p>
          </div>
        );
      })}
    </div>
  </Section>
);
