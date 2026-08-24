/**
 * Shared brand primitives: the monogram, section scaffolding and the two
 * button treatments from the poster. Keeping them here stops the gold and the
 * tracking from drifting section to section.
 */

import React from 'react';

/** The geometric crest monogram from the top of the poster. */
export const Monogram: React.FC<{ size?: number; className?: string }> = ({
  size = 40,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <linearGradient id="scc-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#E3C67F" />
        <stop offset="45%" stopColor="#C5A059" />
        <stop offset="100%" stopColor="#8A6E32" />
      </linearGradient>
    </defs>
    {/* Outer crest diamond */}
    <path
      d="M24 2 46 24 24 46 2 24Z"
      stroke="url(#scc-gold)"
      strokeWidth="1.75"
      fill="none"
    />
    {/* Inner peak — the "crest" */}
    <path
      d="M12 28 24 14 36 28"
      stroke="url(#scc-gold)"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path d="M17 33 24 24 31 33" stroke="url(#scc-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.65" />
  </svg>
);

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
