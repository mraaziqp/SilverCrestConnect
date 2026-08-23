/**
 * On-site activation strip (proposal, section 05).
 *
 * Sits below the donate gateway as reassurance rather than a call to action:
 * it shows supporters what the money actually turns into on the day.
 */

import React from 'react';
import { Images, PiggyBank, QrCode, Coffee } from 'lucide-react';
import { Section, SectionHeading } from './Brand';
import { IMPACT_ITEMS, EVENT } from '../config/event';

const ICONS = [Images, PiggyBank, QrCode, Coffee] as const;

export const ImpactStand: React.FC = () => (
  <Section id="impact" className="border-t border-white/5">
    <SectionHeading
      eyebrow="On the Day"
      title={
        <>
          The Silver Crest <span className="text-gold">Impact Stand</span>
        </>
      }
      lead={`A dedicated stand runs across the full morning, so contributions keep coming in beyond the ticket price.`}
    />

    <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {IMPACT_ITEMS.map((item, index) => {
        const Icon = ICONS[index] ?? Images;
        return (
          <div key={item.title} className="relative pl-6 border-l border-gold/25">
            <Icon className="w-5 h-5 text-gold" aria-hidden="true" />
            <h3 className="mt-4 text-sm font-semibold text-bone">{item.title}</h3>
            <p className="mt-2.5 text-[13px] text-muted leading-relaxed">{item.body}</p>
          </div>
        );
      })}
    </div>

    <p className="mt-14 text-center text-[13px] text-muted/70 max-w-2xl mx-auto leading-relaxed">
      Target: {EVENT.capacityMin}–{EVENT.capacityMax} SMEs at R{EVENT.ticketPriceZAR} each, plus stand and
      online contributions — all funnelled directly into supplies for the {EVENT.causeShort}.
    </p>
  </Section>
);
