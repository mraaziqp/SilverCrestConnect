/**
 * A labelled settings input, with the length limit made visible.
 *
 * The server caps every text field, and a save that silently fails because a
 * paragraph ran three characters long is a maddening thing to debug from the
 * outside. Showing the count as the limit approaches turns that into something
 * you can see coming.
 */

import React from 'react';

const inputClass =
  'w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone ' +
  'placeholder:text-muted/40 focus:border-gold focus:outline-none transition-colors';

interface SettingsFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Renders a textarea of this height instead of a single-line input. */
  rows?: number;
  /** The server's cap for this field, so the counter matches reality. */
  maxLength?: number;
  hint?: React.ReactNode;
  type?: string;
  className?: string;
}

export const SettingsField: React.FC<SettingsFieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  rows,
  maxLength,
  hint,
  type = 'text',
  className = '',
}) => {
  const length = (value ?? '').length;
  // Quiet until it matters, then amber, then red at the limit.
  const near = maxLength !== undefined && length > maxLength * 0.85;
  const over = maxLength !== undefined && length > maxLength;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <label className="block text-[11px] uppercase tracking-[0.14em] text-muted font-semibold">
          {label}
        </label>
        {maxLength !== undefined && (near || over) && (
          <span
            className={`text-[10px] font-mono tabular-nums ${over ? 'text-red-400' : 'text-amber-300'}`}
          >
            {length} / {maxLength}
          </span>
        )}
      </div>

      {rows ? (
        <textarea
          rows={rows}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputClass} resize-y ${over ? 'border-red-500/60' : ''}`}
        />
      ) : (
        <input
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputClass} ${over ? 'border-red-500/60' : ''}`}
        />
      )}

      {hint && <p className="mt-1.5 text-[11px] text-muted/60 leading-relaxed">{hint}</p>}
      {over && (
        <p className="mt-1.5 text-[11px] text-red-400">
          Too long to save — trim {length - (maxLength ?? 0)} character
          {length - (maxLength ?? 0) === 1 ? '' : 's'}.
        </p>
      )}
    </div>
  );
};
