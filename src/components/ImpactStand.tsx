/**
 * On-site activation strip (proposal, section 05).
 *
 * Sits below the donate gateway as reassurance rather than a call to action:
 * it shows supporters what the money actually turns into on the day.
 */

import React from 'react';
import { Images, PiggyBank, QrCode } from 'lucide-react';
import { Section, SectionHeading } from './Brand';
import { fillCopy } from '../lib/copy';
import { IMPACT_ITEMS as DEFAULT_IMPACT_ITEMS, EVENT } from '../config/event';
import type { ImpactItem, EventSettings } from '../types';

const ICONS = [Images, PiggyBank, QrCode] as const;

interface ImpactStandProps {
  impactItems?: ImpactItem[];
  event?: Partial<EventSettings>;
}

export const ImpactStand: React.FC<ImpactStandProps> = ({
  impactItems = DEFAULT_IMPACT_ITEMS,
  event,
}) => {
  const items = impactItems && impactItems.length > 0 ? impactItems : DEFAULT_IMPACT_ITEMS;
  const causeShort = event?.causeShort || EVENT.causeShort;

  return (
    <Section id="impact" className="border-t border-white/5">
      <SectionHeading
        eyebrow="On the Day"
        title={
          <>
            The Silver Crest <span className="text-gold">Impact Stand</span>
          </>
        }
        lead="A dedicated stand runs across the full morning, so contributions keep coming in beyond the ticket price."
      />

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
        {items.map((item, index) => {
          const Icon = ICONS[index % ICONS.length] ?? Images;
          return (
            <div key={item.title || index} className="p-6 rounded-lg bg-ink-raised/60 border border-white/8 hover:border-gold/30 transition-colors">
              <Icon className="w-5 h-5 text-gold" aria-hidden="true" />
              <h3 className="mt-4 text-sm font-semibold text-bone">{item.title}</h3>
              <p className="mt-2 text-[13px] text-muted leading-relaxed">{item.body}</p>
            </div>
          );
        })}
      </div>

      <p className="mt-12 text-center text-[13px] text-muted/70 max-w-2xl mx-auto leading-relaxed">
        {fillCopy(
          event?.impactFundingNote || '100% of every donation goes towards supplies for the {cause}.',
          { cause: causeShort },
        )}
      </p>
    </Section>
  );
};
