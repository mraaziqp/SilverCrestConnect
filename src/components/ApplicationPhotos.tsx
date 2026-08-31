/**
 * Photo picker on the application form.
 *
 * Applicants attach a few pictures — a storefront, product shots, a logo — so
 * the team has something to look at when deciding who is in the room. Text
 * alone makes every catering business read the same.
 *
 * Each photo is resized in the browser and uploaded on selection, so by the
 * time the form is submitted it carries short URLs rather than megabytes of
 * base64. If image storage is unavailable the section hides itself entirely,
 * rather than offering a button that cannot work.
 */

import React, { useEffect, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';

import { api, ApiRequestError } from '../lib/api';
import { prepareImage } from '../lib/image';

interface ApplicationPhotosProps {
  images: string[];
  onChange: (images: string[]) => void;
  disabled?: boolean;
}

export const ApplicationPhotos: React.FC<ApplicationPhotosProps> = ({
  images,
  onChange,
  disabled = false,
}) => {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [maxImages, setMaxImages] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ available: boolean; maxImages: number }>('/api/applications/upload-status')
      .then((result) => {
        setAvailable(result.available);
        setMaxImages(result.maxImages ?? 4);
      })
      .catch(() => setAvailable(false));
  }, []);

  // Nothing to offer, so nothing is shown. An applicant should never see a
  // control that will fail.
  if (available !== true) return null;

  const remaining = maxImages - images.length;

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);

    const accepted: string[] = [];
    const failures: string[] = [];

    for (const file of files.slice(0, remaining)) {
      try {
        // Resized here rather than server-side: a modern phone photo is several
        // megabytes, and uploading it whole over a mobile connection is the
        // slowest part of applying.
        const prepared = await prepareImage(file, { maxDimension: 1600, quality: 0.82 });
        const uploaded = await api<{ url: string }>('/api/applications/upload', {
          method: 'POST',
          body: { dataUri: prepared.dataUri },
        });
        accepted.push(uploaded.url);
      } catch (err) {
        failures.push(
          `${file.name}: ${err instanceof ApiRequestError ? err.message : (err as Error).message}`,
        );
      }
    }

    if (accepted.length > 0) onChange([...images, ...accepted]);
    if (failures.length > 0) {
      setError(
        `${failures.length} ${failures.length === 1 ? 'photo' : 'photos'} could not be added: ${failures.join('; ')}`,
      );
    }
    setBusy(false);
  };

  return (
    <div>
      <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2">
        Photos of your business
      </label>
      <p className="text-[11px] text-muted/60 mb-3 leading-relaxed">
        Optional, up to {maxImages}. Product shots, your storefront or stand, or your logo —
        anything that shows what you do.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {images.map((url, index) => (
          <div
            key={url}
            className="relative aspect-square rounded-sm overflow-hidden border border-white/12 bg-black/40"
          >
            <img
              src={url}
              alt={`Attached photo ${index + 1}`}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => onChange(images.filter((_, i) => i !== index))}
              disabled={disabled || busy}
              aria-label={`Remove photo ${index + 1}`}
              className="absolute top-1 right-1 p-1 rounded-sm bg-black/75 text-bone hover:text-red-400 transition-colors disabled:opacity-40"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {remaining > 0 && (
          <label
            className={`aspect-square rounded-sm border border-dashed border-white/20 flex flex-col items-center justify-center gap-1.5 text-center px-2 transition-colors ${
              disabled || busy
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer hover:border-gold/50 hover:text-gold'
            }`}
          >
            {busy ? (
              <Loader2 className="w-5 h-5 text-gold animate-spin" />
            ) : (
              <ImagePlus className="w-5 h-5 text-muted" aria-hidden="true" />
            )}
            <span className="text-[10px] uppercase tracking-[0.12em] text-muted">
              {busy ? 'Uploading' : 'Add photo'}
            </span>
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={disabled || busy}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                // Cleared first, so choosing the same file again still fires.
                event.target.value = '';
                addFiles(files);
              }}
            />
          </label>
        )}
      </div>

      {error && (
        <p className="mt-2 text-[11px] text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
