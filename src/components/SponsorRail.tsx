/**
 * A band of sponsor logos.
 *
 * One of these sits at each placement offered in the dashboard, and each
 * renders only the sponsors assigned to it — so a rail with nothing in it
 * takes up no space at all rather than leaving an empty heading behind.
 *
 * Logos are supplied with transparent backgrounds, which is why they sit on a
 * light plate. On the dark page a transparent PNG drawn in dark ink would
 * otherwise disappear, and there is no way to know from the file which way a
 * given logo is drawn.
 */

import React from 'react';
import type { Sponsor, SponsorPlacement } from '../types';

interface SponsorRailProps {
  sponsors?: Sponsor[];
  placement: SponsorPlacement;
  /** When false, no rail renders anywhere. Controlled from the dashboard. */
  enabled?: boolean;
  /** Heading above the rail. Hidden when blank. */
  heading?: string;
  className?: string;
}

export const SponsorRail: React.FC<SponsorRailProps> = ({
  sponsors = [],
  placement,
  enabled = true,
  heading,
  className = '',
}) => {
  // Switched off in settings: nothing renders, whatever is stored.
  if (!enabled) return null;

  const mine = sponsors.filter((s) => s.placement === placement && s.logoUrl);
  if (mine.length === 0) return null;

  return (
    <section className={`px-5 sm:px-8 py-10 sm:py-14 ${className}`} aria-label="Sponsors">
      <div className="max-w-6xl mx-auto">
        {heading ? (
          <p className="text-center text-[10px] sm:text-[11px] uppercase tracking-[0.24em] text-muted/70 mb-7">
            {heading}
          </p>
        ) : null}

        {/* Wraps and centres, so any number of logos stays balanced rather than
            stretching to fill a row. */}
        <ul className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          {mine.map((sponsor) => {
            const logo = (
              <span className="flex items-center justify-center h-16 sm:h-20 w-32 sm:w-40 rounded-md bg-white/90 px-4 py-3 transition-transform duration-200 group-hover:scale-[1.03]">
                <img
                  src={sponsor.logoUrl}
                  alt={sponsor.name}
                  loading="lazy"
                  decoding="async"
                  className="max-h-full max-w-full object-contain"
                />
              </span>
            );

            return (
              <li key={sponsor.id}>
                {sponsor.websiteUrl ? (
                  <a
                    href={sponsor.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="group block rounded-md focus:outline-none focus:ring-2 focus:ring-gold/60"
                    title={sponsor.name}
                  >
                    {logo}
                  </a>
                ) : (
                  <span className="group block">{logo}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};
