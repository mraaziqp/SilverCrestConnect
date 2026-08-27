/**
 * Shared brand primitives: the monogram, section scaffolding and the two
 * button treatments from the poster. Keeping them here stops the gold and the
 * tracking from drifting section to section.
 */

import React from 'react';

/** The official Silver Crest logo emblem. */
export const Monogram: React.FC<{
  size?: number;
  className?: string;
  customLogoUrl?: string;
  variant?: 'gold' | 'white';
}> = ({
  size = 40,
  className = '',
  customLogoUrl,
  variant = 'gold',
}) => {
  const src = customLogoUrl || (variant === 'white' ? '/logo-white.svg' : '/logo-gold.svg');

  return (
    <img
      src={src}
      alt="Silver Crest Logo"
      style={{ width: size, height: size, objectFit: 'contain' }}
      className={`inline-block shrink-0 ${className}`}
      aria-hidden="true"
    />
  );
};

/** Full brand lockup matching Image 3 precisely */
export const BrandLogo: React.FC<{
  className?: string;
  customLogoUrl?: string;
  tagline?: string;
  showTagline?: boolean;
}> = ({
  className = '',
  customLogoUrl,
  tagline = 'BUILDING BUSINESS. STRENGTHENING COMMUNITY.',
  showTagline = true,
}) => {
  if (customLogoUrl) {
    return (
      <div className={`flex flex-col items-center justify-center text-center ${className}`}>
        <img
          src={customLogoUrl}
          alt="Silver Crest Connect"
          className="max-h-24 sm:max-h-28 object-contain mb-4"
        />
        {showTagline && (
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.24em] text-gold font-medium mt-3">
            {tagline}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
      {/* Image 3 Geometric Monogram */}
      <Monogram size={76} className="mb-6" />

      {/* SILVER CREST */}
      <div className="font-serif tracking-[0.38em] sm:tracking-[0.45em] text-sm sm:text-base lg:text-lg text-white font-medium uppercase pl-[0.45em] mb-2">
        SILVER CREST
      </div>

      {/* CONNECT with Golden Segmented Ring O and Golden 3-Bar E */}
      <div className="flex items-center justify-center font-sans font-extrabold text-4xl sm:text-6xl lg:text-7xl text-white tracking-[0.14em] sm:tracking-[0.18em] pl-[0.18em] my-1">
        <span>C</span>
        {/* Stylized Golden Ring O with crosshair cuts */}
        <span className="relative inline-flex items-center justify-center w-[0.85em] h-[0.85em] mx-[0.04em] text-gold shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
            <defs>
              <linearGradient id="gold-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#F5D78A" />
                <stop offset="45%" stopColor="#C5A059" />
                <stop offset="100%" stopColor="#8A6E32" />
              </linearGradient>
            </defs>
            {/* 4 segmented arcs forming the O */}
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="url(#gold-ring)"
              strokeWidth="14"
              strokeDasharray="54 10 54 10"
              strokeDashoffset="12"
            />
            {/* Center crosshair notches */}
            <line x1="50" y1="2" x2="50" y2="24" stroke="url(#gold-ring)" strokeWidth="3.5" />
            <line x1="50" y1="76" x2="50" y2="98" stroke="url(#gold-ring)" strokeWidth="3.5" />
            <line x1="2" y1="50" x2="24" y2="50" stroke="url(#gold-ring)" strokeWidth="3.5" />
            <line x1="76" y1="50" x2="98" y2="50" stroke="url(#gold-ring)" strokeWidth="3.5" />
          </svg>
        </span>
        <span>N</span>
        <span>N</span>
        {/* Stylized 3-Bar Gold E */}
        <span className="inline-flex flex-col justify-between h-[0.62em] w-[0.62em] mx-[0.06em] self-center">
          <span className="h-[22%] w-full bg-gradient-to-r from-[#F5D78A] to-[#C5A059] rounded-[1px]" />
          <span className="h-[22%] w-[88%] bg-gradient-to-r from-[#F5D78A] to-[#C5A059] rounded-[1px]" />
          <span className="h-[22%] w-full bg-gradient-to-r from-[#F5D78A] to-[#C5A059] rounded-[1px]" />
        </span>
        <span>C</span>
        <span>T</span>
      </div>

      {/* Sub-banner: BUILDING BUSINESS. STRENGTHENING COMMUNITY. */}
      {showTagline && (
        <div className="mt-5 pt-3 border-t border-gold/30 max-w-lg w-full flex items-center justify-center">
          <p className="text-[10px] sm:text-[11.5px] uppercase tracking-[0.22em] text-gold font-semibold">
            {tagline}
          </p>
        </div>
      )}
    </div>
  );
};

export const SectionHeading: React.FC<{
  eyebrow?: string;
  title: React.ReactNode;
  lead?: string;
  align?: 'left' | 'center';
}> = ({ eyebrow, title, lead, align = 'center' }) => (
  <div className={align === 'center' ? 'text-center max-w-3xl mx-auto' : 'max-w-3xl'}>
    {eyebrow && (
      <p className="text-[11px] sm:text-xs uppercase tracking-brand text-gold font-semibold mb-4">
        {eyebrow}
      </p>
    )}
    <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] leading-[1.15] font-bold text-bone">
      {title}
    </h2>
    {lead && <p className="mt-5 text-base sm:text-lg text-muted leading-relaxed">{lead}</p>}
  </div>
);

export const Section: React.FC<{
  id: string;
  children: React.ReactNode;
  className?: string;
}> = ({ id, children, className = '' }) => (
  <section id={id} className={`py-20 sm:py-28 px-5 sm:px-8 ${className}`}>
    <div className="max-w-6xl mx-auto">{children}</div>
  </section>
);

export const GoldRule: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`h-px w-full rule-gold ${className}`} aria-hidden="true" />
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'gold' | 'outline';
  size?: 'md' | 'lg';
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'gold',
  size = 'md',
  className = '',
  children,
  ...rest
}) => (
  <button
    {...rest}
    className={[
      variant === 'gold' ? 'btn-gold' : 'btn-outline',
      size === 'lg' ? 'px-8 py-4 text-sm' : 'px-6 py-3 text-xs',
      'uppercase tracking-[0.16em] rounded-sm transition-colors duration-200',
      'inline-flex items-center justify-center gap-2.5 whitespace-nowrap',
      className,
    ].join(' ')}
  >
    {children}
  </button>
);

type AnchorProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: 'gold' | 'outline';
  size?: 'md' | 'lg';
};

export const ButtonLink: React.FC<AnchorProps> = ({
  variant = 'gold',
  size = 'md',
  className = '',
  children,
  ...rest
}) => (
  <a
    {...rest}
    className={[
      variant === 'gold' ? 'btn-gold' : 'btn-outline',
      size === 'lg' ? 'px-8 py-4 text-sm' : 'px-6 py-3 text-xs',
      'uppercase tracking-[0.16em] rounded-sm transition-colors duration-200',
      'inline-flex items-center justify-center gap-2.5 whitespace-nowrap',
      className,
    ].join(' ')}
  >
    {children}
  </a>
);

/** Card surface used by pillars, programme rows and the ticket/donate pair. */
export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  featured?: boolean;
}> = ({ children, className = '', featured = false }) => (
  <div
    className={[
      'rounded-lg bg-ink-raised transition-colors duration-300',
      featured
        ? 'border border-gold/45 shadow-[0_0_40px_-12px_rgba(197,160,89,0.35)]'
        : 'border border-white/8 hover:border-gold/30',
      className,
    ].join(' ')}
  >
    {children}
  </div>
);

/** Inline field-level error text. */
export const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? (
    <p className="mt-1.5 text-xs text-red-400" role="alert">
      {message}
    </p>
  ) : null;
