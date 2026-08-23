/**
 * First fold: tagline banner, wordmark, event line, dual CTA.
 * Mirrors the poster composition — centred, generous vertical rhythm,
 * gold hairlines above and below the tagline.
 */

import React, { useEffect, useState } from 'react';
import { CalendarDays, MapPin, Ticket, Heart } from 'lucide-react';
import { Monogram, ButtonLink } from './Brand';
import { EVENT } from '../config/event';

interface HeroProps {
  seatsRemaining: number | null;
}

/** Days/hours/minutes until doors open. Null once the event has started. */
function useCountdown(targetISO: string) {
  const [remaining, setRemaining] = useState<number>(() => new Date(targetISO).getTime() - Date.now());

  useEffect(() => {
    const target = new Date(targetISO).getTime();
    const tick = () => setRemaining(target - Date.now());
    tick();
    // Minute resolution is plenty and keeps the render cheap.
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [targetISO]);

  if (remaining <= 0) return null;
  return {
    days: Math.floor(remaining / 86_400_000),
    hours: Math.floor((remaining % 86_400_000) / 3_600_000),
    minutes: Math.floor((remaining % 3_600_000) / 60_000),
  };
}

export const Hero: React.FC<HeroProps> = ({ seatsRemaining }) => {
  const countdown = useCountdown(EVENT.startsAtISO);

  return (
    <section id="top" className="relative min-h-[100svh] flex items-center justify-center px-5 sm:px-8 pt-24 pb-16 overflow-hidden">
      {/* Ambient gold wash behind the wordmark, kept subtle so text stays crisp. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 45% at 50% 38%, rgba(197,160,89,0.13), transparent 70%)',
        }}
      />
      {/* Fine grid, echoing the poster's structural feel. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(197,160,89,1) 1px, transparent 1px), linear-gradient(90deg, rgba(197,160,89,1) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent 75%)',
        }}
      />

      <div className="relative text-center max-w-4xl mx-auto">
        <Monogram size={64} className="mx-auto mb-9" />

        {/* Tagline banner */}
        <div className="flex items-center justify-center gap-4 sm:gap-6 mb-8">
          <span className="hidden sm:block h-px w-12 lg:w-20 rule-gold" aria-hidden="true" />
          <p className="text-[10px] sm:text-[11px] uppercase tracking-brand text-gold font-semibold leading-relaxed">
            {EVENT.tagline}
          </p>
          <span className="hidden sm:block h-px w-12 lg:w-20 rule-gold" aria-hidden="true" />
        </div>

        <h1 className="font-display font-bold text-bone leading-[1.05] text-[2.6rem] sm:text-6xl lg:text-7xl uppercase tracking-[0.06em]">
          Silver Crest
          <span className="block text-gold mt-2">Connect {EVENT.edition}</span>
        </h1>

        <p className="mt-8 text-base sm:text-lg text-muted max-w-2xl mx-auto leading-relaxed">
          An exclusive half-day B2B networking showcase for {EVENT.capacityMin}–{EVENT.capacityMax} vetted
          SME founders — where local business growth funds real community impact.
        </p>

        {/* Event line */}
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm">
          <span className="inline-flex items-center gap-2.5 text-bone">
            <CalendarDays className="w-4 h-4 text-gold shrink-0" />
            <span className="font-medium">
              {EVENT.dateLabel} · {EVENT.timeLabel}
            </span>
          </span>
          <span className="hidden sm:block w-px h-4 bg-white/15" aria-hidden="true" />
          <span className="inline-flex items-center gap-2.5 text-muted">
            <MapPin className="w-4 h-4 text-gold shrink-0" />
            <span>{EVENT.venueCity}</span>
          </span>
        </div>

        <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-muted/70">
          Presented by {EVENT.presentedBy}
        </p>

        {/* Dual CTA */}
        <div className="mt-11 flex flex-col sm:flex-row items-center justify-center gap-4">
          <ButtonLink href="#tickets" size="lg" className="w-full sm:w-auto">
            <Ticket className="w-4 h-4" />
            Get Event Tickets
          </ButtonLink>
          <ButtonLink href="#donate" variant="outline" size="lg" className="w-full sm:w-auto">
            <Heart className="w-4 h-4 text-gold" />
            Support / Donate
          </ButtonLink>
        </div>

        {/* Scarcity + countdown strip */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[11px] uppercase tracking-[0.18em] text-muted/80">
          {countdown && (
            <span>
              <span className="text-gold font-semibold">{countdown.days}</span> days
              <span className="mx-1.5 text-white/20">/</span>
              <span className="text-gold font-semibold">{countdown.hours}</span> hrs
              <span className="mx-1.5 text-white/20">/</span>
              <span className="text-gold font-semibold">{countdown.minutes}</span> min
            </span>
          )}
          {countdown && seatsRemaining !== null && (
            <span className="hidden sm:block w-px h-3 bg-white/15" aria-hidden="true" />
          )}
          {seatsRemaining !== null && (
            <span>
              <span className="text-gold font-semibold">{seatsRemaining}</span> of {EVENT.capacity} seats remaining
            </span>
          )}
        </div>
      </div>
    </section>
  );
};
