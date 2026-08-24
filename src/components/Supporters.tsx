/**
 * Supporters wall.
 *
 * Named donors only — anonymous gifts are filtered out server-side, and no
 * amounts are ever shown. Social proof, not a leaderboard: the point is that
 * people are giving, not who gave most.
 *
 * Renders nothing until there is something to show, so the section does not
 * sit empty on launch day.
 */

import React, { useEffect, useState } from 'react';
import { Quote } from 'lucide-react';
import { Section, SectionHeading, Card } from './Brand';
import { api } from '../lib/api';

interface Supporter {
  name: string;
  message?: string;
  at: string;
}

export const Supporters: React.FC = () => {
  const [supporters, setSupporters] = useState<Supporter[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ supporters: Supporter[] }>('/api/supporters')
      .then((result) => {
        if (!cancelled) setSupporters(result.supporters);
      })
      .catch(() => {
        // A wall of names is a bonus, not load-bearing. Stay silent on failure.
        if (!cancelled) setSupporters([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!supporters || supporters.length === 0) return null;

  // Messages carry more weight than bare names, so lead with them.
  const withMessage = supporters.filter((s) => s.message);
  const nameOnly = supporters.filter((s) => !s.message);

  return (
    <Section id="supporters" className="border-t border-white/5">
      <SectionHeading
        eyebrow="Thank You"
        title={
          <>
            Our <span className="text-gold">supporters</span>
          </>
        }
        lead="People and businesses backing the Year-End Community Outreach Drive."
      />

      {withMessage.length > 0 && (
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {withMessage.slice(0, 6).map((supporter, index) => (
            <Card key={`${supporter.name}-${index}`} className="p-6">
              <Quote className="w-4 h-4 text-gold/50" aria-hidden="true" />
              <blockquote className="mt-4 text-[14px] text-muted leading-relaxed">
                {supporter.message}
              </blockquote>
              <p className="mt-4 text-[12px] uppercase tracking-[0.14em] text-bone font-semibold">
                {supporter.name}
              </p>
            </Card>
          ))}
        </div>
      )}

      {nameOnly.length > 0 && (
        <ul className="mt-10 flex flex-wrap justify-center gap-x-3 gap-y-2">
          {nameOnly.map((supporter, index) => (
            <li
              key={`${supporter.name}-${index}`}
              className="px-3.5 py-1.5 rounded-sm border border-white/10 text-[13px] text-muted"
            >
              {supporter.name}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
};
