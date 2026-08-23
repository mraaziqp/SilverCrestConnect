/**
 * 404. Previously any unknown path silently rendered the landing page, which
 * hides typos and mis-sent links — a mistyped reference in an approval email
 * would have looked like a working homepage rather than a broken link.
 */

import React from 'react';
import { Monogram, ButtonLink } from './Brand';
import { EVENT } from '../config/event';

export const NotFound: React.FC = () => (
  <main className="min-h-[100svh] flex items-center justify-center px-5 py-20">
    <div className="w-full max-w-md text-center">
      <a href="/" aria-label={`${EVENT.fullName} home`} className="inline-block mb-10">
        <Monogram size={48} />
      </a>

      <p className="font-mono text-[11px] uppercase tracking-brand text-gold">Error 404</p>
      <h1 className="mt-5 font-display text-3xl font-bold text-bone">Page not found</h1>
      <p className="mt-4 text-[15px] text-muted leading-relaxed">
        That link does not lead anywhere. If you followed it from an email, the reference may have
        been cut short — check the full code and try again.
      </p>

      <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
        <ButtonLink href="/">Back to the event</ButtonLink>
        <ButtonLink href={`mailto:${EVENT.contactEmail}`} variant="outline">
          Contact us
        </ButtonLink>
      </div>
    </div>
  </main>
);
