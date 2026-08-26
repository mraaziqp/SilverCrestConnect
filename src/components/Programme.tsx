/**
 * Event details: the 4-hour agenda and the three-step vetting funnel.
 * Both come straight from the proposal so the page and the PDF cannot drift.
 */

import React from 'react';
import { Section, SectionHeading, Card } from './Brand';
import { FUNNEL_STEPS, WELCOME_PACK as DEFAULT_WELCOME_PACK } from '../config/event';
import type { WelcomePackItem } from '../types';

interface ProgrammeProps {
  welcomePack?: WelcomePackItem[];
}

export const Programme: React.FC<ProgrammeProps> = ({ welcomePack = DEFAULT_WELCOME_PACK }) => {
  const packItems = welcomePack && welcomePack.length > 0 ? welcomePack : DEFAULT_WELCOME_PACK;

  return (
    <Section id="how-to-join" className="border-t border-white/5">
      {/* Vetting funnel */}
      <div>
        <SectionHeading
          eyebrow="How to Join"
          title={
            <>
              Three steps to your <span className="text-gold">seat</span>
            </>
          }
          lead="Seats are vetted to keep the room exclusive and the introductions worth making. Applying is free — you only pay once you are approved."
        />

        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {FUNNEL_STEPS.map((step) => (
            <li key={step.step}>
              <Card className="h-full p-7">
                <span className="font-display text-3xl font-bold text-gold/35 leading-none">
                  {step.step}
                </span>
                <h3 className="mt-5 text-base font-semibold text-bone">{step.title}</h3>
                <p className="mt-3 text-[13.5px] text-muted leading-relaxed">{step.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </div>

      {/* Welcome pack (What every registered SME receives) */}
      <div className="mt-14 rounded-lg border border-gold/20 bg-gradient-to-br from-gold/[0.06] to-transparent p-7 sm:p-9">
        <h3 className="text-[11px] uppercase tracking-brand text-gold font-semibold">
          Every registered SME receives
        </h3>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {packItems.map((item) => (
            <div key={item.title}>
              <h4 className="text-sm font-semibold text-bone">{item.title}</h4>
              <p className="mt-1.5 text-[13px] text-muted leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
};
