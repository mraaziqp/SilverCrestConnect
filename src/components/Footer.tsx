/**
 * Simple footer: contact, copyright, socials.
 * The brief asked for nothing more than this.
 */

import React from 'react';
import { Mail, Globe, Linkedin, Instagram, Facebook } from 'lucide-react';
import { Monogram, GoldRule } from './Brand';
import { EVENT } from '../config/event';

const SOCIALS = [
  { key: 'linkedin', href: EVENT.social.linkedin, Icon: Linkedin, label: 'LinkedIn' },
  { key: 'instagram', href: EVENT.social.instagram, Icon: Instagram, label: 'Instagram' },
  { key: 'facebook', href: EVENT.social.facebook, Icon: Facebook, label: 'Facebook' },
] as const;

export const Footer: React.FC = () => {
  const activeSocials = SOCIALS.filter((s) => s.href);

  return (
    <footer className="px-5 sm:px-8 pb-12 pt-16">
      <div className="max-w-6xl mx-auto">
        <GoldRule />

        <div className="mt-12 flex flex-col md:flex-row md:items-start justify-between gap-10">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <Monogram size={32} />
              <span className="font-display text-[13px] uppercase tracking-brand text-bone font-bold">
                Silver Crest Connect
              </span>
            </div>
            <p className="mt-5 text-[13px] text-muted leading-relaxed">
              {EVENT.tagline} — {EVENT.dateLabel}, {EVENT.venueCity}. Presented by {EVENT.presentedBy}.
            </p>
          </div>

          <div>
            <h3 className="text-[11px] uppercase tracking-brand text-gold font-semibold">Contact</h3>
            <ul className="mt-5 space-y-3">
              <li>
                <a
                  href={`mailto:${EVENT.contactEmail}`}
                  className="inline-flex items-center gap-2.5 text-[13px] text-muted hover:text-gold transition-colors"
                >
                  <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {EVENT.contactEmail}
                </a>
              </li>
              <li>
                <a
                  href={EVENT.companyWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 text-[13px] text-muted hover:text-gold transition-colors"
                >
                  <Globe className="w-4 h-4 shrink-0" aria-hidden="true" />
                  silvercrestconsulting.co.za
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
              100% of ticket proceeds and every donation fund supplies for the {EVENT.causeShort}.
              Nothing is retained for event overheads.
            </p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[12px] text-muted/60">
            © {new Date().getFullYear()} {EVENT.presentedBy}. All rights reserved.
          </p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted/50">
            Payments secured by PayFast
          </p>
        </div>
      </div>
    </footer>
  );
};
