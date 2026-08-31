/**
 * Event details: the join funnel and what every registered SME receives.
 *
 * The step count in the heading is derived from the list, so removing or
 * adding a step cannot leave the wording saying the wrong number.
 */

import React from 'react';
import { Section, SectionHeading, Card } from './Brand';
import { FUNNEL_STEPS, WELCOME_PACK as DEFAULT_WELCOME_PACK } from '../config/event';
import type { FunnelStepItem, WelcomePackItem } from '../types';

const STEP_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five'] as const;

interface ProgrammeProps {
  welcomePack?: WelcomePackItem[];
  /** The join steps, as edited in the dashboard. */
  funnelSteps?: FunnelStepItem[];
}

export const Programme: React.FC<ProgrammeProps> = ({
  welcomePack = DEFAULT_WELCOME_PACK,
  funnelSteps,
}) => {
  const packItems = welcomePack && welcomePack.length > 0 ? welcomePack : DEFAULT_WELCOME_PACK;
  // Falling back to the defaults keeps the section from vanishing if the API
  // is unreachable, or if every step is deleted in the dashboard by accident.
  const steps = funnelSteps && funnelSteps.length > 0 ? funnelSteps : FUNNEL_STEPS;
  const stepWord = STEP_WORDS[steps.length] ?? String(steps.length);

  return (
    <Section id="how-to-join" className="border-t border-white/5">
      {/* Vetting funnel */}
      <div>
        <SectionHeading
          eyebrow="How to Join"
          title={
            <>
              {stepWord} steps to your <span className="text-gold">seat</span>
            </>
          }
          lead="Seats are limited to ensure high-value connections. Applying is free, and payment is only requested once your business is approved."
        />

        {/* Two cards would stretch oddly across the full width, so the list is
            capped and centred. */}
        <ol className="mt-12 grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <li key={step.id ?? step.title}>
              <Card className="h-full p-7">
                <span className="font-display text-3xl font-bold text-gold/35 leading-none">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-5 text-base font-semibold text-bone">{step.title}</h3>
                <p className="mt-3 text-[13.5px] text-muted leading-relaxed">
                  {step.body}
                </p>
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
