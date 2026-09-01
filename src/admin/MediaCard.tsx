/**
 * The card used to manage one image in the dashboard.
 *
 * Both the photo gallery and the sponsor logos are lists of pictures with a
 * little metadata, and both were previously edited as rows of raw URLs with a
 * thumbnail the size of a postage stamp. You could not tell at a glance which
 * photo was which, and the URL — the one field nobody needs to read — took up
 * most of the width.
 *
 * So: the picture is the card. Actions sit on the image, the fields that
 * matter sit under it, and the URL is tucked behind a toggle for the rare
 * occasion someone needs to paste one.
 */

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Link2, Trash2 } from 'lucide-react';

interface MediaCardProps {
  url: string;
  onUrlChange: (url: string) => void;
  /** Alt text for the preview. Falls back to a positional description. */
  label?: string;
  /** Shown top-left, e.g. "Featured". */
  badge?: string;
  /** How the image sits in its frame. Photos crop; logos must not. */
  fit?: 'cover' | 'contain';
  onRemove: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  disabled?: boolean;
  /** Caption, name, placement — whatever this list needs. */
  children?: React.ReactNode;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  url,
  onUrlChange,
  label,
  badge,
  fit = 'cover',
  onRemove,
  onMoveLeft,
  onMoveRight,
  disabled = false,
  children,
}) => {
  // Shown automatically when there is no image yet, since pasting a link is
  // then the only way to fill the card.
  const [showUrl, setShowUrl] = useState(!url);
  const [failed, setFailed] = useState(false);

  const isInline = url.startsWith('data:');

  return (
    <div className="rounded-lg border border-white/10 bg-black/30 overflow-hidden flex flex-col">
      {/* Preview */}
      <div
        className={`relative group aspect-[4/3] ${
          fit === 'contain' ? 'bg-white/[0.06]' : 'bg-black/50'
        }`}
      >
        {url && !failed ? (
          <img
            src={url}
            alt={label ?? 'Preview'}
            onError={() => setFailed(true)}
            onLoad={() => setFailed(false)}
            // Absolutely positioned, not `h-full`: a percentage height inside
            // an aspect-ratio box resolves against content, so the image's own
            // proportions win and the frame stops being 4:3.
            className={`absolute inset-0 w-full h-full ${
              fit === 'contain' ? 'object-contain p-4' : 'object-cover'
            }`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
            <span className="text-[11px] text-muted/60 leading-relaxed">
              {failed ? 'That link did not load' : 'No image yet — paste a link below'}
            </span>
          </div>
        )}

        {badge && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-sm bg-gold text-black text-[9px] font-bold uppercase tracking-[0.12em]">
            {badge}
          </span>
        )}

        {isInline && (
          <span
            className="absolute bottom-2 left-2 px-2 py-0.5 rounded-sm bg-amber-500/90 text-black text-[9px] font-bold uppercase tracking-[0.1em]"
            title="Stored in the database rather than image storage — every visitor downloads it with the page."
          >
            In database
          </span>
        )}

        {/* Actions. Always visible on touch, where there is no hover. */}
        <div className="absolute top-2 right-2 flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
          {onMoveLeft && (
            <button
              type="button"
              onClick={onMoveLeft}
              disabled={disabled}
              aria-label={`Move ${label ?? 'image'} earlier`}
              className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded bg-black/80 text-bone hover:text-gold disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {onMoveRight && (
            <button
              type="button"
              onClick={onMoveRight}
              disabled={disabled}
              aria-label={`Move ${label ?? 'image'} later`}
              className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded bg-black/80 text-bone hover:text-gold disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label={`Remove ${label ?? 'image'}`}
            className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded bg-black/80 text-bone hover:text-red-400 disabled:opacity-40 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="p-3 space-y-2 flex-1 flex flex-col">
        {children}

        <div className="mt-auto pt-1">
          {showUrl ? (
            <input
              value={isInline ? '' : url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder={isInline ? 'Uploaded image — paste a link to replace it' : 'https://… image link'}
              aria-label={`${label ?? 'Image'} link`}
              spellCheck={false}
              className="w-full rounded-sm bg-black/50 border border-white/12 px-2.5 py-1.5 text-[11px] text-bone placeholder:text-muted/40 focus:border-gold focus:outline-none transition-colors"
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowUrl(true)}
              className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-muted/70 hover:text-gold transition-colors"
            >
              <Link2 className="w-3 h-3" />
              Edit link
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/** Moves an item within a list, returning a new array. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
