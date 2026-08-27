/**
 * SME application modal (funnel step 01).
 *
 * Submitting is free; it creates a PENDING_REVIEW record for the Silver Crest
 * team to vet. Field errors come back keyed by field name from the server and
 * are rendered inline.
 */

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, X } from 'lucide-react';
import { Button, FieldError } from './Brand';
import { api, ApiRequestError } from '../lib/api';

interface ApplicationFormProps {
  open: boolean;
  onClose: () => void;
}

interface FormState {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  industry: string;
  website: string;
  registrationNumber: string;
  about: string;
  lookingFor: string;
}

const EMPTY: FormState = {
  businessName: '',
  contactName: '',
  email: '',
  phone: '',
  industry: '',
  website: '',
  registrationNumber: '',
  about: '',
  lookingFor: '',
};

interface SubmitResult {
  reference: string;
  message: string;
}

export const ApplicationForm: React.FC<ApplicationFormProps> = ({ open, onClose }) => {
  const [values, setValues] = useState<FormState>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Lock the page behind the dialog and move focus into it.
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

  // Reset only after the dialog has closed, so the success state stays visible
  // for as long as the user has it open.
  useEffect(() => {
    if (open) return;
    const id = window.setTimeout(() => {
      setValues(EMPTY);
      setFieldErrors({});
      setFormError(null);
      setResult(null);
    }, 200);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open) return null;

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((prev) => ({ ...prev, [key]: e.target.value }));
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

    try {
      const response = await api<{ reference: string; message: string }>('/api/applications', {
        method: 'POST',
        body: values,
      });
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
      className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-sm"
      onMouseDown={(e) => {
        // Close only on a click that both starts and ends on the backdrop.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-title"
        className="relative w-full max-w-2xl my-8 rounded-lg border border-gold/25 bg-ink-raised shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close application form"
          className="absolute top-4 right-4 p-2 text-muted hover:text-bone transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {result ? (
          <div className="p-8 sm:p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-gold mx-auto" aria-hidden="true" />
            <h2 id="application-title" className="mt-6 font-display text-2xl font-bold text-bone">
              Application received
            </h2>
            <p className="mt-4 text-[14px] text-muted leading-relaxed max-w-md mx-auto">
              {result.message}
            </p>

            <div className="mt-8 rounded-sm border border-gold/30 bg-gold/[0.06] px-6 py-5">
              <p className="text-[10px] uppercase tracking-brand text-gold font-semibold">
                Your reference
              </p>
              <p className="mt-2 font-mono text-xl text-bone tracking-[0.15em]">{result.reference}</p>
            </div>
            <p className="mt-4 text-[12px] text-muted/70">
              Keep this reference — you will need it to pay once approved.
            </p>

            <Button className="mt-8 w-full sm:w-auto" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-7 sm:p-10" noValidate>
            <p className="text-[10px] uppercase tracking-brand text-gold font-semibold">
              Step 01: Application & Sector Review
            </p>
            <h2 id="application-title" className="mt-3 font-display text-2xl sm:text-3xl font-bold text-bone">
              Apply for a Seat
            </h2>
            <p className="mt-3 text-[13.5px] text-muted leading-relaxed">
              Attendance is strictly curated with a maximum of 2 to 3 businesses per industry sector.
              Submit your details for review, and upon approval our team will email your private payment link to book your spot.
            </p>

            {formError && (
              <div className="mt-6 rounded-sm border border-red-500/40 bg-red-500/10 px-4 py-3" role="alert">
                <p className="text-[13px] text-red-300">{formError}</p>
              </div>
            )}

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <Field
                ref={firstFieldRef}
                id="businessName"
                label="Business name"
                value={values.businessName}
                onChange={set('businessName')}
                error={fieldErrors.businessName}
                autoComplete="organization"
                required
              />
              <Field
                id="contactName"
                label="Your full name"
                value={values.contactName}
                onChange={set('contactName')}
                error={fieldErrors.contactName}
                autoComplete="name"
                required
              />
              <Field
                id="email"
                label="Email address"
                type="email"
                value={values.email}
                onChange={set('email')}
                error={fieldErrors.email}
                autoComplete="email"
                required
              />
              <Field
                id="phone"
                label="Contact number"
                type="tel"
                value={values.phone}
                onChange={set('phone')}
                error={fieldErrors.phone}
                autoComplete="tel"
                placeholder="+27 82 000 0000"
                required
              />
              <Field
                id="industry"
                label="Industry / sector"
                value={values.industry}
                onChange={set('industry')}
                error={fieldErrors.industry}
                placeholder="e.g. Catering, IT services, Logistics"
                required
              />
              <Field
                id="registrationNumber"
                label="CIPC registration no."
                value={values.registrationNumber}
                onChange={set('registrationNumber')}
                error={fieldErrors.registrationNumber}
                placeholder="Optional"
              />
              <div className="sm:col-span-2">
                <Field
                  id="website"
                  label="Website or social page"
                  value={values.website}
                  onChange={set('website')}
                  error={fieldErrors.website}
                  placeholder="Optional — helps us verify faster"
                />
              </div>
              <div className="sm:col-span-2">
                <TextArea
                  id="about"
                  label="Tell us about your business"
                  value={values.about}
                  onChange={set('about')}
                  error={fieldErrors.about}
                  hint="At least 20 characters."
                  rows={4}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <TextArea
                  id="lookingFor"
                  label="What are you hoping to get from the room?"
                  value={values.lookingFor}
                  onChange={set('lookingFor')}
                  error={fieldErrors.lookingFor}
                  hint="Optional — helps us seat you well."
                  rows={2}
                />
              </div>
            </div>

            <div className="mt-8 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
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
                  'Submit application'
                )}
              </Button>
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
