/**
 * "You have an application in progress" — shown to a returning applicant.
 *
 * Without this, someone who applied last week and closed the tab has no way
 * back unless they kept the code. There is no lookup by email, on purpose, so
 * the device remembering is the only self-service route.
 *
 * Renders nothing when this device has never submitted one, which is most
 * visitors.
 */

import React, { useEffect, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';

import {
  forgetApplication,
  listSavedApplications,
  type SavedApplication,
} from '../lib/savedApplications';

export const SavedApplicationBanner: React.FC = () => {
  const [saved, setSaved] = useState<SavedApplication[]>([]);

  // Read after mount: localStorage is not available while server-rendering,
  // and reading during render would make the first paint depend on it.
  useEffect(() => {
    setSaved(listSavedApplications());
  }, []);

  if (saved.length === 0) return null;

  return (
    <div className="border-b border-gold/20 bg-gold/[0.07]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-[12.5px] text-bone/90">
          {saved.length === 1 ? (
            <>
              You have an application in progress
              {saved[0].businessName ? ` for ${saved[0].businessName}` : ''}.
            </>
          ) : (
            <>You have {saved.length} applications in progress.</>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {saved.slice(0, 3).map((item) => (
            <a
              key={item.reference}
              href={`/pay/${encodeURIComponent(item.reference)}`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm border border-gold/40 text-[11px] font-mono tracking-wider text-gold hover:bg-gold/10 transition-colors"
            >
              {item.reference}
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </a>
          ))}

          <button
            type="button"
            onClick={() => {
              saved.forEach((item) => forgetApplication(item.reference));
              setSaved([]);
            }}
            aria-label="Stop showing this on this device"
            title="Stop showing this on this device"
            className="p-1 text-muted/70 hover:text-bone transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
