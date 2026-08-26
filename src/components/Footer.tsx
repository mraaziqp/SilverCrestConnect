/**
 * Simple footer: contact, copyright, socials.
 * The brief asked for nothing more than this.
 */

import React from 'react';
import { Mail, Globe, Linkedin, Instagram, Facebook } from 'lucide-react';
import { Monogram, GoldRule } from './Brand';
import { EVENT } from '../config/event';
import type { EventSettings } from '../types';

const SOCIALS = [
  { key: 'linkedin', href: EVENT.social.linkedin, Icon: Linkedin, label: 'LinkedIn' },
  { key: 'instagram', href: EVENT.social.instagram, Icon: Instagram, label: 'Instagram' },
  { key: 'facebook', href: EVENT.social.facebook, Icon: Facebook, label: 'Facebook' },
] as const;

interface FooterProps {
  event?: Partial<EventSettings>;
}

export const Footer: React.FC<FooterProps> = ({ event }) => {
  const activeSocials = SOCIALS.filter((s) => s.href);
  const fullName = event?.fullName || EVENT.fullName;
  const tagline = event?.tagline || EVENT.tagline;
  const dateLabel = event?.dateLabel || EVENT.dateLabel;
  const venueLocation = event?.venueCity || event?.venue || EVENT.venueCity;
  const contactEmail = event?.contactEmail || EVENT.contactEmail;
  const companyWebsite = event?.companyWebsite || 'https://scconsults.co.za';
  const customLogoUrl = event?.customLogoUrl;
  const footerNote = event?.footerNote || EVENT.footerNote;
  const copyrightText = event?.copyrightText || `${fullName}. All rights reserved.`;

  return (
    <footer className="px-5 sm:px-8 pb-12 pt-16">
      <div className="max-w-6xl mx-auto">
        <GoldRule />

        <div className="mt-12 flex flex-col md:flex-row md:items-start justify-between gap-10">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <Monogram size={32} customLogoUrl={customLogoUrl} />
              <span className="font-display text-[13px] uppercase tracking-brand text-bone font-bold">
                {fullName}
              </span>
            </div>
            <p className="mt-5 text-[13px] text-muted leading-relaxed">
              {tagline} — {dateLabel}, {venueLocation}.
            </p>
          </div>

          <div>
            <h3 className="text-[11px] uppercase tracking-brand text-gold font-semibold">Contact</h3>
            <ul className="mt-5 space-y-3">
              <li>
                <a
                  href={`mailto:${contactEmail}`}
                  className="inline-flex items-center gap-2.5 text-[13px] text-muted hover:text-gold transition-colors"
                >
                  <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {contactEmail}
                </a>
              </li>
              <li>
                <a
                  href={companyWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 text-[13px] text-muted hover:text-gold transition-colors"
                >
                  <Globe className="w-4 h-4 shrink-0" aria-hidden="true" />
                  scconsults.co.za
                </a>
              </li>
            </ul>

            {activeSocials.length > 0 && (
              <div className="mt-6 flex items-center gap-4">
                {activeSocials.map(({ key, href, Icon, label }) => (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="text-muted hover:text-gold transition-colors"
                  >
                    <Icon className="w-[18px] h-[18px]" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="max-w-xs">
            <h3 className="text-[11px] uppercase tracking-brand text-gold font-semibold">
              Where your money goes
            </h3>
            <p className="mt-5 text-[13px] text-muted leading-relaxed">
              {footerNote}
            </p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[12px] text-muted/60">
            © {new Date().getFullYear()} {copyrightText}
          </p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted/50">
            Payments secured by PayFast
          </p>
        </div>
      </div>
    </footer>
  );
};
