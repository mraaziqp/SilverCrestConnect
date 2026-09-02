/**
 * Donation gateway — the "Support Our Community Drive" portal from the
 * proposal. Open to anyone: supporters and non-attending businesses can give
 * a custom amount without applying for a seat.
 */

import React, { useMemo, useState } from 'react';
import { Heart, Loader2, Maximize2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Section, SectionHeading, Card, Button, FieldError } from './Brand';
import { fillCopy } from '../lib/copy';
import { EVENT, DONATION_PRESETS, DONATION_MIN_ZAR, DONATION_MAX_ZAR, DEFAULT_GALLERY } from '../config/event';
import { api, ApiRequestError, formatZAR } from '../lib/api';
import { redirectToPayFast } from '../lib/payfast';
import type { CheckoutResponse, EventSettings, GalleryItem } from '../types';

interface DonateProps {
  /** Photos from the previous outreach drive, shown beside the form. */
  gallery?: GalleryItem[];
  galleryHeading?: string;
  galleryBody?: string;
  totalRaisedZAR: number | null;
  supporters: number | null;
  /** False while the site cannot take money yet. */
  paymentsOpen?: boolean;
  event?: Partial<EventSettings>;
}

export const Donate: React.FC<DonateProps> = ({
  totalRaisedZAR,
  supporters,
  gallery = [],
  galleryHeading,
  galleryBody,
  paymentsOpen = true,
  event,
}) => {
  const displayGallery = gallery && gallery.length > 0 ? gallery : DEFAULT_GALLERY;
  const [preset, setPreset] = useState<number | null>(DONATION_PRESETS[1]);
  const [custom, setCustom] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A preset click and a typed amount are mutually exclusive; whichever the
  // user touched last wins.
  const amount = useMemo(() => {
    if (preset !== null) return preset;
    const parsed = Number.parseFloat(custom.replace(/[,\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }, [preset, custom]);

  const amountValid = amount >= DONATION_MIN_ZAR && amount <= DONATION_MAX_ZAR;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const result = await api<CheckoutResponse>('/api/checkout/donation', {
        method: 'POST',
        body: { name, email, amount, message, anonymous },
      });
      redirectToPayFast(result);
      // Navigation happens here, so `busy` intentionally remains true.
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFormError(err.message);
        if (err.fieldErrors) setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Could not start the donation. Please try again.');
      }
      setBusy(false);
    }
  };

  const causeShort = event?.causeShort || EVENT.causeShort;

  return (
    <Section id="donate" className="border-t border-white/5">
      <SectionHeading
        eyebrow="Support the Cause"
        title={
          <>
            {(() => {
              // The heading is editable, and names the cause via {cause}. The
              // cause itself is highlighted wherever it lands in the sentence.
              const heading = fillCopy(
                event?.donateHeading || 'Fund the {cause}',
                { cause: causeShort },
              );
              const [before, after] = heading.split(causeShort);
              return after === undefined ? (
                heading
              ) : (
                <>
                  {before}
                  <span className="text-gold">{causeShort}</span>
                  {after}
                </>
              );
            })()}
          </>
        }
        lead={fillCopy(
          event?.donateLead ||
            'You do not have to attend to make an impact. 100% of every donation goes towards supplies for the {cause}.',
          { cause: causeShort },
        )}
      />

      {/* Running total, when there is one worth showing. */}
      {totalRaisedZAR !== null && totalRaisedZAR > 0 && (
        <div className="mt-12 flex flex-wrap items-center justify-center gap-10 sm:gap-16 text-center">
          <div>
            <p className="font-display text-3xl sm:text-4xl font-bold text-gold">
              {formatZAR(totalRaisedZAR)}
            </p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-muted/70">raised so far</p>
          </div>
          {supporters !== null && supporters > 0 && (
            <div>
              <p className="font-display text-3xl sm:text-4xl font-bold text-bone">{supporters}</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-muted/70">supporters</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] items-start">
        <Card featured className="p-8 sm:p-10">
          <form onSubmit={submit} noValidate>
            <h3 className="font-display text-xl font-bold text-bone">Make a direct donation</h3>

            {formError && (
              <div className="mt-5 rounded-sm border border-red-500/40 bg-red-500/10 px-4 py-3" role="alert">
                <p className="text-[13px] text-red-300">{formError}</p>
              </div>
            )}

            {/* Preset amounts */}
            <fieldset className="mt-7">
              <legend className="text-[11px] uppercase tracking-[0.14em] text-muted mb-3">
                Choose an amount
              </legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {DONATION_PRESETS.map((value) => {
                  const active = preset === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setPreset(value);
                        setCustom('');
                      }}
                      aria-pressed={active}
                      className={[
                        'py-3 rounded-sm text-sm font-semibold transition-colors border',
                        active
                          ? 'bg-gold text-black border-gold'
                          : 'bg-black/40 text-bone border-white/12 hover:border-gold/50',
                      ].join(' ')}
                    >
                      {formatZAR(value)}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Custom amount */}
            <div className="mt-5">
              <label htmlFor="donate-custom" className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2">
                Or enter your own amount
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gold font-semibold pointer-events-none">
                  R
                </span>
                <input
                  id="donate-custom"
                  type="text"
                  inputMode="decimal"
                  value={custom}
                  onChange={(e) => {
                    // Digits and one decimal point only.
                    const cleaned = e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
                    setCustom(cleaned);
                    setPreset(null);
                  }}
                  placeholder="Custom amount"
                  aria-invalid={Boolean(fieldErrors.amount)}
                  className={`w-full rounded-sm bg-black/50 border pl-9 pr-4 py-3 text-sm text-bone placeholder:text-muted/40 focus:border-gold focus:outline-none transition-colors ${
                    fieldErrors.amount ? 'border-red-500/60' : 'border-white/12'
                  }`}
                />
              </div>
              <FieldError message={fieldErrors.amount} />
              {!fieldErrors.amount && (
                <p className="mt-1.5 text-[11px] text-muted/60">
                  Minimum {formatZAR(DONATION_MIN_ZAR)}.
                </p>
              )}
            </div>

            {/* Donor details */}
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="donate-name" className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2">
                  Your name <span className="text-gold">*</span>
                </label>
                <input
                  id="donate-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                  aria-invalid={Boolean(fieldErrors.name)}
                  className={`w-full rounded-sm bg-black/50 border px-4 py-2.5 text-sm text-bone placeholder:text-muted/40 focus:border-gold focus:outline-none transition-colors ${
                    fieldErrors.name ? 'border-red-500/60' : 'border-white/12'
                  }`}
                />
                <FieldError message={fieldErrors.name} />
              </div>
              <div>
                <label htmlFor="donate-email" className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2">
                  Email address <span className="text-gold">*</span>
                </label>
                <input
                  id="donate-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  aria-invalid={Boolean(fieldErrors.email)}
                  className={`w-full rounded-sm bg-black/50 border px-4 py-2.5 text-sm text-bone placeholder:text-muted/40 focus:border-gold focus:outline-none transition-colors ${
                    fieldErrors.email ? 'border-red-500/60' : 'border-white/12'
                  }`}
                />
                <FieldError message={fieldErrors.email} />
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="donate-message" className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2">
                Message of support
              </label>
              <input
                id="donate-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Optional"
                maxLength={200}
                className="w-full rounded-sm bg-black/50 border border-white/12 px-4 py-2.5 text-sm text-bone placeholder:text-muted/40 focus:border-gold focus:outline-none transition-colors"
              />
            </div>

            <label className="mt-5 flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="w-4 h-4 accent-[#C5A059]"
              />
              <span className="text-[13px] text-muted">Keep my donation anonymous</span>
            </label>

            {paymentsOpen ? (
              <>
                <Button type="submit" size="lg" className="w-full mt-8" disabled={busy || !amountValid}>
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Redirecting to PayFast…
                    </>
                  ) : (
                    <>
                      <Heart className="w-4 h-4" />
                      Donate {amountValid ? formatZAR(amount) : ''}
                    </>
                  )}
                </Button>

                <p className="mt-4 text-center text-[12px] text-muted/70 leading-relaxed">
                  Processed securely by PayFast. Card details are entered on PayFast's page and never
                  touch this site.
                </p>
              </>
            ) : (
              /* Taking someone through the form only to fail at the gateway
                 wastes their goodwill. Say it up front instead. */
              <div className="mt-8 rounded-sm border border-gold/30 bg-gold/[0.06] px-5 py-4 text-center">
                <p className="text-sm font-semibold text-gold">Donations open shortly</p>
                <p className="mt-2 text-[13px] text-muted leading-relaxed">
                  We are finalising our secure payment setup. Thank you for wanting to
                  help — please check back soon.
                </p>
              </div>
            )}
          </form>
        </Card>

        <PreviousDrive heading={galleryHeading} body={galleryBody} items={displayGallery} />
      </div>
    </Section>
  );
};

/**
 * Photos from the last outreach drive.
 *
 * Displays the real care packages and supplies from past outreach drives so donors
 * can see the direct community impact, with an interactive popup lightbox for full-screen view.
 */
const PreviousDrive: React.FC<{
  heading?: string;
  body?: string;
  items: GalleryItem[];
}> = ({ heading, body, items }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Keyboard navigation for lightbox
  React.useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLightboxOpen(false);
      if (e.key === 'ArrowRight') setSelectedIndex((prev) => (prev + 1) % items.length);
      if (e.key === 'ArrowLeft') setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, items.length]);

  if (items.length === 0) return null;

  const current = items[selectedIndex] || items[0];

  return (
    <div className="lg:sticky lg:top-24 space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-brand text-gold font-semibold">
          {heading || 'Where Your Donations Go'}
        </p>
        <h4 className="mt-1 font-display text-lg font-bold text-bone">
          Previous Outreach Drive
        </h4>
        <p className="mt-2 text-[13px] text-muted leading-relaxed">
          {body || 'Real supplies, care parcels, and winter warmth kits prepared and distributed to local families.'}
        </p>
      </div>

      {/* Featured Photo Display with Click to Expand */}
      <figure
        onClick={() => setIsLightboxOpen(true)}
        className="group relative cursor-pointer overflow-hidden rounded-xl border border-white/12 bg-ink-raised shadow-xl transition-all duration-300 hover:border-gold/50 hover:shadow-gold/10"
      >
        <div className="relative aspect-[4/3] bg-black/60 overflow-hidden">
          <img
            src={current.url}
            alt={current.caption || 'Care supplies from previous outreach drive'}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Zoom Overlay Badge */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/80 text-gold text-xs font-semibold backdrop-blur-sm border border-gold/40">
              <Maximize2 className="w-3.5 h-3.5" /> Click to enlarge
            </span>
            <span className="text-[11px] text-white/80 font-mono">
              {selectedIndex + 1} / {items.length}
            </span>
          </div>
        </div>
        {current.caption && (
          <figcaption className="px-5 py-3.5 text-xs text-muted/90 bg-ink/90 border-t border-white/8 leading-relaxed">
            {current.caption}
          </figcaption>
        )}
      </figure>

      {/* Thumbnails list */}
      {items.length > 1 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted/70 font-medium">
              Care Packages ({selectedIndex + 1} of {items.length})
            </p>
            <button
              type="button"
              onClick={() => setIsLightboxOpen(true)}
              className="text-[11px] text-gold hover:underline inline-flex items-center gap-1"
            >
              <Maximize2 className="w-3 h-3" /> View full screen
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            {items.map((item, idx) => {
              const active = idx === selectedIndex;
              return (
                <button
                  key={item.id || idx}
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  className={`relative rounded-lg overflow-hidden border-2 aspect-square transition-all ${
                    active
                      ? 'border-gold shadow-md shadow-gold/20 scale-[1.02]'
                      : 'border-white/10 opacity-70 hover:opacity-100 hover:border-white/30'
                  }`}
                  aria-label={`View photo ${idx + 1}`}
                >
                  <img
                    src={item.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Full-Screen Popup Lightbox Modal */}
      {isLightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo Preview"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 text-bone hover:bg-white/20 hover:text-gold transition-colors z-10"
            aria-label="Close photo preview"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Previous photo button */}
          {items.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
              }}
              className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 border border-white/20 text-bone hover:border-gold hover:text-gold transition-all z-10"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Next photo button */}
          {items.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedIndex((prev) => (prev + 1) % items.length);
              }}
              className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 border border-white/20 text-bone hover:border-gold hover:text-gold transition-all z-10"
              aria-label="Next photo"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Modal Content */}
          <div
            className="relative max-w-4xl max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={current.url}
              alt={current.caption || 'Community outreach photo'}
              className="max-w-full max-h-[70vh] rounded-lg object-contain shadow-2xl border border-white/15"
            />
            <div className="mt-4 text-center max-w-2xl px-4">
              {current.caption ? (
                <p className="text-sm sm:text-base text-bone font-medium leading-relaxed">
                  {current.caption}
                </p>
              ) : (
                <p className="text-sm text-muted">Silver Crest Outreach Drive Supplies</p>
              )}
              <p className="mt-1 text-xs font-mono text-gold/80">
                Photo {selectedIndex + 1} of {items.length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
