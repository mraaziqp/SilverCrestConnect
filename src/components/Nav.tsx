/**
 * Sticky navigation.
 *
 * Per the client brief the links are anchors only — About, Tickets, Donate —
 * with the Buy Tickets call to action held in the bar at all times.
 */

import React, { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Monogram, ButtonLink } from './Brand';
import { EVENT } from '../config/event';
import type { EventSettings } from '../types';

const LINKS = [
  { href: '#about', label: 'About' },
  { href: '#how-to-join', label: 'How to Join' },
  { href: '#tickets', label: 'Tickets' },
  { href: '#donate', label: 'Donate' },
];

interface NavProps {
  event?: Partial<EventSettings>;
}

export const Nav: React.FC<NavProps> = ({ event }) => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const fullName = event?.fullName || EVENT.fullName;
  const customLogoUrl = event?.customLogoUrl;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <header
      className={[
        'fixed top-0 inset-x-0 z-50 transition-colors duration-300',
        scrolled || menuOpen
          ? 'bg-ink/95 backdrop-blur-md border-b border-white/8'
          : 'bg-transparent border-b border-transparent',
      ].join(' ')}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between h-[72px]">
          {/* Wordmark */}
          <a href="#top" className="flex items-center gap-3 shrink-0" aria-label={`${fullName} home`}>
            <Monogram size={34} customLogoUrl={customLogoUrl} />
            <span className="font-display text-[13px] sm:text-[15px] uppercase tracking-brand text-bone font-bold leading-none">
              {event?.name || 'Silver Crest'}<span className="hidden sm:inline"> Connect</span>
            </span>
          </a>

          {/* Desktop links */}
          <nav className="hidden md:flex items-center gap-9" aria-label="Primary">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[11px] uppercase tracking-[0.18em] text-muted hover:text-gold transition-colors font-medium"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <ButtonLink href="#tickets" className="hidden sm:inline-flex">
              Buy Tickets
            </ButtonLink>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="md:hidden p-2 -mr-2 text-bone"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sheet */}
      {menuOpen && (
        <nav className="md:hidden border-t border-white/8 bg-ink px-5 py-6" aria-label="Primary mobile">
          <ul className="space-y-1">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block py-3 text-sm uppercase tracking-[0.16em] text-muted hover:text-gold transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <ButtonLink href="#tickets" onClick={() => setMenuOpen(false)} className="w-full mt-5">
            Buy Tickets
          </ButtonLink>
        </nav>
      )}
    </header>
  );
};
