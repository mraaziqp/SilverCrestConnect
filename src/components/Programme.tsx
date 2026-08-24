/**
 * Event details: the 4-hour agenda and the three-step vetting funnel.
 * Both come straight from the proposal so the page and the PDF cannot drift.
 */

import React from 'react';
import { Section, SectionHeading, Card } from './Brand';
import { EVENT, PROGRAMME, FUNNEL_STEPS, WELCOME_PACK } from '../config/event';

const KIND_LABEL: Record<string, string> = {
  keynote: 'Keynote',
  spotlight: 'SME Spotlight',
  session: 'Session',
};

export const Programme: React.FC = () => (
  <Section id="programme" className="border-t border-white/5">
    <SectionHeading
      eyebrow="Event Details"
      title={
        <>
          The <span className="text-gold">programme</span>
        </>
      }
      lead={`A structured four-hour agenda on ${EVENT.dateLabel}, ${EVENT.timeLabel}.`}
    />

    {/* Agenda */}
    <div className="mt-14 overflow-hidden rounded-lg border border-white/8">
      <ul className="divide-y divide-white/5">
        {PROGRAMME.map((slot) => (
          <li
            key={slot.time}
            className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-8 gap-y-2 px-5 sm:px-8 py-5 bg-ink-raised hover:bg-white/[0.02] transition-colors"
          >
            <div className="sm:w-40 shrink-0">
              <p className="font-mono text-[13px] text-gold tabular-nums">{slot.time}</p>
              <p className="text-[11px] text-muted/60 mt-0.5">{slot.duration}</p>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-[15px] font-semibold text-bone">{slot.title}</h3>
                <span
                  className={[
                    'text-[9px] uppercase tracking-[0.16em] px-2 py-0.5 rounded-sm border',
                    slot.kind === 'keynote'
                      ? 'border-gold/40 text-gold bg-gold/8'
                      : 'border-white/12 text-muted/70',
                  ].join(' ')}
                >
                  {KIND_LABEL[slot.kind]}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] text-muted leading-relaxed">{slot.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>

    {/* Vetting funnel */}
    <div className="mt-20">
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

    {/* Welcome pack */}
    <div className="mt-14 rounded-lg border border-gold/20 bg-gradient-to-br from-gold/[0.06] to-transparent p-7 sm:p-9">
      <h3 className="text-[11px] uppercase tracking-brand text-gold font-semibold">
        Every registered SME receives
      </h3>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {WELCOME_PACK.map((item) => (
          <div key={item.title}>
            <h4 className="text-sm font-semibold text-bone">{item.title}</h4>
            <p className="mt-1.5 text-[13px] text-muted leading-relaxed">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  </Section>
);
