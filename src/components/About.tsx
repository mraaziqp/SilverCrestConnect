/**
 * About the event and the cause.
 *
 * The brief asked for two feature boxes — networking/growth and community
 * impact — sitting under a short mission statement. The four proposal pillars
 * fold into those two boxes so the section stays tight.
 */

import React from 'react';
import { Section, SectionHeading } from './Brand';
import { EVENT } from '../config/event';
import type { EventSettings } from '../types';

interface AboutProps {
  event?: Partial<EventSettings>;
}

export const About: React.FC<AboutProps> = ({ event }) => {
  const aboutTitle = event?.aboutTitle || EVENT.aboutTitle;
  const aboutLead = event?.aboutLead || EVENT.aboutLead;
  const aboutBody = event?.aboutBody || EVENT.aboutBody;

  return (
    <Section id="about" className="border-t border-white/5">
      <SectionHeading
        eyebrow="About the Event"
        title={<span className="text-bone">{aboutTitle}</span>}
        lead={aboutLead}
      />

      {aboutBody && (
        <div className="mt-10 max-w-3xl mx-auto text-center">
          <p className="text-[15px] sm:text-base text-muted leading-relaxed">
            {aboutBody}
          </p>
        </div>
      )}
    </Section>
  );
};
