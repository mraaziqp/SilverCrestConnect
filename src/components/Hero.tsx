/**
 * First fold: tagline banner, wordmark, event line, dual CTA.
 * Mirrors the poster composition — centred, generous vertical rhythm,
 * gold hairlines above and below the tagline.
 */

import React, { useEffect, useState } from 'react';
import { CalendarDays, MapPin, Ticket, Heart } from 'lucide-react';
import { BrandLogo, ButtonLink } from './Brand';
import { EVENT } from '../config/event';
import { formatZAR } from '../lib/api';
import type { EventSettings } from '../types';

interface HeroProps {
  seatsRemaining: number | null;
  event?: Partial<EventSettings>;
}

/** Days/hours/minutes until doors open. Null once the event has started. */
function useCountdown(targetISO: string) {
  const [remaining, setRemaining] = useState<number>(() => new Date(targetISO).getTime() - Date.now());

  useEffect(() => {
    const target = new Date(targetISO).getTime();
    const tick = () => setRemaining(target - Date.now());
    tick();
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

export const Hero: React.FC<HeroProps> = ({ seatsRemaining, event }) => {
  const startsAtISO = event?.startsAtISO || EVENT.startsAtISO;
  const dateLabel = event?.dateLabel || EVENT.dateLabel;
  const timeLabel = event?.timeLabel || EVENT.timeLabel;
  const venueLocation = event?.venueCity || event?.venue || EVENT.venueCity;
  const heroParagraph = event?.heroParagraph || EVENT.heroParagraph;
  const capacity = event?.capacity ?? EVENT.capacity;
  const ticketPrice = event?.ticketPriceZAR ?? EVENT.ticketPriceZAR;
  const tagline = event?.tagline || EVENT.tagline;
  const customLogoUrl = event?.customLogoUrl;

  const countdown = useCountdown(startsAtISO);

  return (
    <section id="top" className="relative min-h-[100svh] flex items-center justify-center px-5 sm:px-8 pt-28 pb-16 overflow-hidden">
      {/* Ambient gold wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 45% at 50% 38%, rgba(197,160,89,0.13), transparent 70%)',
        }}
      />
      {/* Fine grid */}
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

      <div className="relative text-center max-w-4xl mx-auto min-w-0">
        {/* Brand Logo & Wordmark matching Image 3 */}
        <BrandLogo
          customLogoUrl={customLogoUrl}
          tagline={tagline}
          className="mb-8"
        />

        <p className="mt-6 text-base sm:text-lg text-muted max-w-2xl mx-auto leading-relaxed">
          {heroParagraph}
        </p>

        {/* Event line */}
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm">
          <span className="inline-flex items-center gap-2.5 text-bone">
            <CalendarDays className="w-4 h-4 text-gold shrink-0" />
            <span className="font-medium">
              {dateLabel} · {timeLabel}
            </span>
          </span>
          <span className="hidden sm:block w-px h-4 bg-white/15" aria-hidden="true" />
          <span className="inline-flex items-center gap-2.5 text-muted">
            <MapPin className="w-4 h-4 text-gold shrink-0" />
            <span>{venueLocation}</span>
          </span>
        </div>

        {/* Dual CTA */}
        <div className="mt-11 flex flex-col sm:flex-row items-center justify-center gap-4">
          <ButtonLink href="#tickets" size="lg" className="w-full sm:w-auto">
            <Ticket className="w-4 h-4" />
            {event?.ticketPriceZAR !== undefined
              ? `APPLY TO ATTEND — ${formatZAR(ticketPrice)}`
              : 'APPLY TO ATTEND'}
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
          {/* A count of zero is not a count. "0 of 50 seats remaining" reads as
              a bug rather than as news, so a full room says so in words. */}
          {seatsRemaining !== null && (
            <span>
              {seatsRemaining <= 0 ? (
                <span className="text-gold font-semibold">All seats taken</span>
              ) : (
                <>
                  <span className="text-gold font-semibold">{seatsRemaining}</span> of {capacity} seats remaining
                </>
              )}
            </span>
          )}
        </div>
      </div>
    </section>
  );
};
