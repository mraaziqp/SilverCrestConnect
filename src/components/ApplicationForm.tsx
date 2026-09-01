/**
 * SME application modal (funnel step 01).
 *
 * Submitting is free; it creates a PENDING_REVIEW record for the Silver Crest
 * team to vet. Attendance is strictly curated (1-2 businesses per category).
 * Allows applying for one representative at the base fee, or two at the base
 * fee plus the additional-representative fee. Both are set in /admin.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, Copy, Loader2, Users, X } from 'lucide-react';
import { Button, FieldError } from './Brand';
import { EVENT, INDUSTRY_CATEGORIES } from '../config/event';
import { api, ApiRequestError, formatZAR } from '../lib/api';
import type { EventSettings } from '../types';
import { copyToClipboard } from '../lib/clipboard';
import { rememberApplication, applicationUrl } from '../lib/savedApplications';
import { ApplicationPhotos } from './ApplicationPhotos';

interface ApplicationFormProps {
  open: boolean;
  onClose: () => void;
  event?: Partial<EventSettings>;
}

interface FormState {
  businessName: string;
  contactName: string;
  applicantRole: string;
  email: string;
  phone: string;
  industry: string;
  customIndustry: string;
  website: string;
  registrationNumber: string;
  about: string;
  productsServices: string;
  communityContribution: string;
  lookingFor: string;
  attendeeCount: 1 | 2;
  rep2Name: string;
  rep2Role: string;
  rep2Email: string;
  rep2Phone: string;
}

const EMPTY: FormState = {
  businessName: '',
  contactName: '',
  applicantRole: '',
  email: '',
  phone: '',
  // Deliberately blank. Defaulting to the first category silently files
  // every applicant who skips the dropdown under Accounting & Financial
  // Services, which is the one field the curated 1-2-per-category review
  // depends on being true.
  industry: '',
  customIndustry: '',
  website: '',
  registrationNumber: '',
  about: '',
  productsServices: '',
  communityContribution: '',
  lookingFor: '',
  attendeeCount: 1,
  rep2Name: '',
  rep2Role: '',
  rep2Email: '',
  rep2Phone: '',
};

interface SubmitResult {
  reference: string;
  message: string;
}

export const ApplicationForm: React.FC<ApplicationFormProps> = ({ open, onClose, event }) => {
  const [values, setValues] = useState<FormState>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Uploaded photo URLs, kept apart from the text fields. */
  const [images, setImages] = useState<string[]>([]);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const basePrice = event?.ticketPriceZAR ?? EVENT.ticketPriceZAR;
  const additionalRepPrice = event?.additionalRepPriceZAR ?? EVENT.additionalRepPriceZAR;
  const twoRepTotal = basePrice + additionalRepPrice;

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    firstFieldRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    const id = window.setTimeout(() => {
      setValues(EMPTY);
      setImages([]);
      setFieldErrors({});
      setFormError(null);
      setResult(null);
    }, 200);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open) return null;

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const val = e.target.value;
    setValues((prev) => ({ ...prev, [key]: val }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setFieldErrors({});

    const finalIndustry =
      values.industry === 'Other / Specialized Services' && values.customIndustry.trim()
        ? values.customIndustry.trim()
        : values.industry;

    const payload = {
      ...values,
      industry: finalIndustry,
      // Already uploaded; these are URLs, not file data.
      images,
    };

    try {
      const response = await api<{ reference: string; message: string }>('/api/applications', {
        method: 'POST',
        body: payload,
      });
      // Saved on this device so a returning applicant has a way back even if
      // they never copied the code and the email has not arrived.
      rememberApplication(response.reference, values.businessName);
      setResult({ reference: response.reference, message: response.message });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFormError(err.message);
        if (err.fieldErrors) setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Could not submit your application. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/85 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-title"
        className="relative w-full max-w-2xl my-6 rounded-lg border border-gold/25 bg-ink-raised shadow-2xl max-h-[92vh] overflow-y-auto touch-scroll overscroll-contain"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close application form"
          className="absolute top-4 right-4 p-2 text-muted hover:text-bone transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {result ? (
          <div className="p-8 sm:p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-gold mx-auto" aria-hidden="true" />
            <h2 id="application-title" className="mt-6 font-display text-2xl font-bold text-bone">
              Application Received
            </h2>
            <p className="mt-4 text-[14px] text-muted leading-relaxed max-w-md mx-auto">
              {result.message}
            </p>

            <div className="mt-8 rounded-sm border border-gold/30 bg-gold/[0.06] px-6 py-5">
              <p className="text-[10px] uppercase tracking-brand text-gold font-semibold">
                Your Reference Number
              </p>
              <div className="mt-2 flex items-center justify-center gap-3">
                <p className="font-mono text-xl text-bone tracking-[0.15em]">{result.reference}</p>
                <button
                  type="button"
                  onClick={async () => {
                    if (!(await copyToClipboard(result.reference))) return;
                    setCopiedRef(true);
                    setTimeout(() => setCopiedRef(false), 2000);
                  }}
                  className="px-2.5 py-1 rounded bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors inline-flex items-center gap-1.5 text-xs font-semibold"
                  title="Copy reference number"
                >
                  {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRef ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
            {/* A bookmarkable link, not just a code. Saved on this device too,
                so the banner on the home page brings them back — but a link
                they can send to themselves survives a new phone. */}
            <div className="mt-4 rounded-sm border border-white/10 bg-black/30 px-4 py-3">
              <p className="text-[10px] uppercase tracking-brand text-muted font-semibold">
                Your status page — bookmark this
              </p>
              <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
                <code className="font-mono text-[11px] text-bone/90 break-all">
                  {applicationUrl(result.reference)}
                </code>
                <button
                  type="button"
                  onClick={async () => {
                    if (!(await copyToClipboard(applicationUrl(result.reference)))) return;
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="px-2.5 py-1 rounded bg-white/5 border border-white/15 text-muted hover:text-gold hover:border-gold/40 transition-colors inline-flex items-center gap-1.5 text-[11px] font-semibold shrink-0"
                  title="Copy the link to your application"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy link'}</span>
                </button>
              </div>
            </div>

            <p className="mt-4 text-[12px] text-muted/70">
              We have saved this on this device, so you can come back to it from the home page.
              Once approved, you will also receive your private payment link by email.
            </p>

            <Button className="mt-8 w-full sm:w-auto" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 sm:p-10" noValidate>
            <div className="border-b border-white/8 pb-6">
              <span className="inline-block px-2.5 py-0.5 rounded bg-gold/15 border border-gold/30 text-[10px] uppercase tracking-brand text-gold font-bold mb-2">
                Curated Business-to-Business Showcase
              </span>
              <h2 id="application-title" className="font-display text-2xl sm:text-3xl font-bold text-bone">
                Apply to Attend — Silver Crest Connect '26
              </h2>
              <p className="mt-2.5 text-[13px] text-muted leading-relaxed">
                Connect is a curated event aiming for <strong>1–2 businesses per category</strong> to ensure meaningful networking and prevent service oversaturation.
                Submitting is free. Payment is only requested once your application is approved.
              </p>
            </div>

            {formError && (
              <div className="mt-6 rounded-sm border border-red-500/40 bg-red-500/10 px-4 py-3" role="alert">
                <p className="text-[13px] text-red-300">{formError}</p>
              </div>
            )}

            {/* Representative Count Selector */}
            <div className="mt-7">
              <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2.5">
                Number of Representatives Attending <span className="text-gold">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setValues((prev) => ({ ...prev, attendeeCount: 1 }))}
                  className={`p-4 rounded-md border text-left transition-all ${
                    values.attendeeCount === 1
                      ? 'border-gold bg-gold/10 text-bone shadow-sm'
                      : 'border-white/12 bg-black/30 text-muted hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">1 Representative</span>
                    <span className="font-bold text-gold">{formatZAR(basePrice)}</span>
                  </div>
                  <p className="mt-1 text-[11.5px] text-muted">Primary booking. Includes breakfast & full access.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setValues((prev) => ({ ...prev, attendeeCount: 2 }))}
                  className={`p-4 rounded-md border text-left transition-all ${
                    values.attendeeCount === 2
                      ? 'border-gold bg-gold/10 text-bone shadow-sm'
                      : 'border-white/12 bg-black/30 text-muted hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">2 Representatives</span>
                    <span className="font-bold text-gold">{formatZAR(twoRepTotal)}</span>
                  </div>
                  <p className="mt-1 text-[11.5px] text-muted">
                    +{formatZAR(additionalRepPrice)} for employee/co-worker (incl. breakfast).
                  </p>
                </button>
              </div>
            </div>

            {/* Primary Applicant Details */}
            <div className="mt-7 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  ref={firstFieldRef}
                  id="businessName"
                  label="Business Name"
                  value={values.businessName}
                  onChange={set('businessName')}
                  error={fieldErrors.businessName}
                  autoComplete="organization"
                  required
                />
                <Field
                  id="contactName"
                  label="Your Full Name"
                  value={values.contactName}
                  onChange={set('contactName')}
                  error={fieldErrors.contactName}
                  autoComplete="name"
                  required
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="applicantRole"
                  label="Your Role / Position"
                  value={values.applicantRole}
                  onChange={set('applicantRole')}
                  error={fieldErrors.applicantRole}
                  placeholder="e.g. Founder, Managing Director, Head of Operations"
                  required
                />
                <Field
                  id="email"
                  label="Email Address"
                  type="email"
                  value={values.email}
                  onChange={set('email')}
                  error={fieldErrors.email}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="phone"
                  label="Contact Number"
                  type="tel"
                  value={values.phone}
                  onChange={set('phone')}
                  error={fieldErrors.phone}
                  autoComplete="tel"
                  placeholder="+27 82 000 0000"
                  required
                />

                {/* Industry Category Dropdown */}
                <div>
                  <label htmlFor="industry" className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2">
                    Industry / Sector <span className="text-gold">*</span>
                  </label>
                  <select
                    id="industry"
                    name="industry"
                    required
                    value={values.industry}
                    onChange={set('industry')}
                    className="w-full rounded-sm bg-black/50 border border-white/12 px-4 py-2.5 text-sm text-bone focus:border-gold focus:outline-none transition-colors"
                  >
                    <option value="" disabled className="bg-ink text-muted">
                      Select your industry…
                    </option>
                    {INDUSTRY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-ink text-bone">
                        {cat}
                      </option>
                    ))}
                  </select>
                  {/* The form submits with noValidate, so a missing industry
                      comes back as a server field error. Without this the
                      rejection had nowhere to show and the form just failed. */}
                  <FieldError message={fieldErrors.industry} />
                </div>
              </div>

              {values.industry === 'Other / Specialized Services' && (
                <Field
                  id="customIndustry"
                  label="Specify Your Industry / Niche"
                  value={values.customIndustry}
                  onChange={set('customIndustry')}
                  error={fieldErrors.industry}
                  placeholder="e.g. Renewable Energy, Marine Surveying, Aviation"
                  required
                />
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="registrationNumber"
                  label="CIPC Registration Number"
                  value={values.registrationNumber}
                  onChange={set('registrationNumber')}
                  error={fieldErrors.registrationNumber}
                  placeholder="Optional"
                />
                <Field
                  id="website"
                  label="Website or Social Media Page"
                  value={values.website}
                  onChange={set('website')}
                  error={fieldErrors.website}
                  placeholder="Optional — helps us verify faster"
                />
              </div>

              {/* Business Description & Offerings */}
              <TextArea
                id="about"
                label="Tell us about your business"
                value={values.about}
                onChange={set('about')}
                error={fieldErrors.about}
                hint="Brief background on your company and target market (minimum 20 characters)."
                rows={3}
                required
              />

              <TextArea
                id="productsServices"
                label="What products or services does your business provide?"
                value={values.productsServices}
                onChange={set('productsServices')}
                error={fieldErrors.productsServices}
                placeholder="e.g. Commercial legal advisory, bespoke software development, corporate tax accounting"
                rows={2}
                required
              />

              <TextArea
                id="communityContribution"
                label="What can you bring to the Connect community?"
                value={values.communityContribution}
                onChange={set('communityContribution')}
                error={fieldErrors.communityContribution}
                placeholder="e.g. Strategic partnership opportunities, industry insights, cross-referral network"
                rows={2}
                required
              />

              <TextArea
                id="lookingFor"
                label="What are you hoping to get from Connect?"
                value={values.lookingFor}
                onChange={set('lookingFor')}
                error={fieldErrors.lookingFor}
                hint="Optional — helps us introduce you to relevant founders in the room."
                rows={2}
              />
            </div>

            <div className="sm:col-span-2">
              <ApplicationPhotos images={images} onChange={setImages} disabled={busy} />
            </div>

            {/* Second Representative Details (if 2 selected) */}
            {values.attendeeCount === 2 && (
              <div className="mt-8 pt-6 border-t border-gold/20 bg-ink/40 p-5 rounded-md">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 text-gold" />
                  <h4 className="text-xs uppercase tracking-brand text-gold font-bold">
                    Second Representative Details (+{formatZAR(additionalRepPrice)})
                  </h4>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="rep2Name"
                    label="Full Name"
                    value={values.rep2Name}
                    onChange={set('rep2Name')}
                    error={fieldErrors.rep2Name}
                    required
                  />
                  <Field
                    id="rep2Role"
                    label="Role / Position"
                    value={values.rep2Role}
                    onChange={set('rep2Role')}
                    error={fieldErrors.rep2Role}
                    required
                  />
                  <Field
                    id="rep2Email"
                    label="Email Address"
                    type="email"
                    value={values.rep2Email}
                    onChange={set('rep2Email')}
                    error={fieldErrors.rep2Email}
                    required
                  />
                  <Field
                    id="rep2Phone"
                    label="Contact Number"
                    type="tel"
                    value={values.rep2Phone}
                    onChange={set('rep2Phone')}
                    error={fieldErrors.rep2Phone}
                    required
                  />
                </div>
              </div>
            )}

            {/* Total summary & Action */}
            <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted">
                  Total Upon Approval:
                </p>
                <p className="text-xl font-bold text-gold">
                  {formatZAR(values.attendeeCount === 2 ? twoRepTotal : basePrice)}{' '}
                  <span className="text-xs text-muted font-normal">
                    ({values.attendeeCount} {values.attendeeCount === 1 ? 'attendee' : 'attendees'}, incl. breakfast)
                  </span>
                </p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-center gap-3 w-full sm:w-auto">
                <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    'Submit Application for Review'
                  )}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ form fields

const inputClass =
  'w-full rounded-sm bg-black/50 border border-white/12 px-4 py-2.5 text-sm text-bone ' +
  'placeholder:text-muted/40 focus:border-gold focus:outline-none transition-colors';

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
}

const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ id, label, error, required, ...rest }, ref) => (
    <div>
      <label htmlFor={id} className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2">
        {label}
        {required && <span className="text-gold ml-1">*</span>}
      </label>
      <input
        {...rest}
        ref={ref}
        id={id}
        name={id}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputClass} ${error ? 'border-red-500/60' : ''}`}
      />
      <div id={`${id}-error`}>
        <FieldError message={error} />
      </div>
    </div>
  ),
);
Field.displayName = 'Field';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}

const TextArea: React.FC<TextAreaProps> = ({ id, label, error, hint, required, ...rest }) => (
  <div>
    <label htmlFor={id} className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2">
      {label}
      {required && <span className="text-gold ml-1">*</span>}
    </label>
    <textarea
      {...rest}
      id={id}
      name={id}
      required={required}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${id}-error` : undefined}
      className={`${inputClass} resize-y ${error ? 'border-red-500/60' : ''}`}
    />
    {hint && !error && <p className="mt-1.5 text-[11px] text-muted/60">{hint}</p>}
    <div id={`${id}-error`}>
      <FieldError message={error} />
    </div>
  </div>
);
