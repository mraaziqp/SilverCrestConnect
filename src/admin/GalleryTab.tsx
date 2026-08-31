/**
 * Gallery editor — the photos shown beside the donation form.
 *
 * Two ways to add an image, because Firebase Storage requires a billing plan
 * and may not be available: upload a file directly when it is, paste a URL
 * when it is not. The tab asks the server which applies rather than assuming,
 * so it degrades to something usable instead of showing a broken button.
 */

import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Loader2, Plus, Save, Trash2 } from 'lucide-react';

import { Button, Card } from '../components/Brand';
import { api, ApiRequestError } from '../lib/api';
import type { GalleryItem } from '../types';
import { prepareImage, formatBytes } from '../lib/image';

interface GalleryRow {
  key: string;
  url: string;
  caption: string;
}

let rowCounter = 0;
const nextKey = () => `row-${(rowCounter += 1)}`;

export const GalleryTab: React.FC<{ token: string }> = ({ token }) => {
  const [rows, setRows] = useState<GalleryRow[]>([]);
  const [canUpload, setCanUpload] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ gallery?: GalleryItem[] }>('/api/event')
      .then((result) =>
        setRows(
          (result.gallery ?? []).map((item) => ({
            key: nextKey(),
            url: item.url,
            caption: item.caption ?? '',
          })),
        ),
      )
      .catch(() => setError('Could not load the current gallery.'));

    api<{ available: boolean }>('/api/admin/storage-status', { token })
      .then((result) => {
        setCanUpload(result.available);
      })
      .catch(() => setCanUpload(false));
  }, [token]);

  const persist = async (next: GalleryRow[]) => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await api('/api/admin/gallery', {
        method: 'PUT',
        token,
        body: { items: next.map(({ url, caption }) => ({ url, caption })) },
      });
      setRows(next);
      setStatus('Gallery saved.');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save the gallery.');
    } finally {
      setBusy(false);
    }
  };

  /** Above this a data URI is too heavy to keep in the datastore. */
  const MAX_INLINE_BYTES = 700 * 1024;

  const uploadFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      // Resize before anything else. A phone photo posted at full size is what
      // made this time out at the gateway, and what left megabyte-sized strings
      // in the datastore for every visitor to download afterwards.
      const prepared = await prepareImage(file, { maxDimension: 1600, quality: 0.82 });

      if (canUpload) {
        try {
          const uploaded = await api<{ url: string }>('/api/admin/upload-image', {
            method: 'POST',
            token,
            body: { dataUri: prepared.dataUri, folder: 'gallery' },
          });
          await persist([...rows, { key: nextKey(), url: uploaded.url, caption: '' }]);
          setStatus(`Photo uploaded (${formatBytes(prepared.bytes)}).`);
          return;
        } catch (err) {
          // Cloud storage refused. Falling back is fine for a small image and
          // wrong for a large one, so the size decides rather than hope.
          if (prepared.bytes > MAX_INLINE_BYTES) {
            setError(
              `${err instanceof ApiRequestError ? err.message : 'Upload failed.'} ` +
                `This photo is ${formatBytes(prepared.bytes)}, too large to store without cloud storage. ` +
                'Paste an image URL instead.',
            );
            return;
          }
        }
      }

      if (prepared.bytes > MAX_INLINE_BYTES) {
        setError(
          `That photo is ${formatBytes(prepared.bytes)} after resizing, and cloud storage is not ` +
            'available to hold it. Paste an image URL instead.',
        );
        return;
      }

      await persist([...rows, { key: nextKey(), url: prepared.dataUri, caption: '' }]);
      setStatus(`Photo saved (${formatBytes(prepared.bytes)}).`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : (err as Error).message || 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  const update = (index: number, patch: Partial<GalleryRow>) => {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  return (
    <div className="max-w-4xl">
      <Card className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-display text-lg font-bold text-bone">Previous Drive Photo Gallery</h3>
            <p className="mt-2 text-[13px] text-muted leading-relaxed max-w-xl">
              Photos shown beside and around the donation form to show the impact of previous outreach drives.
              Supporters can click and browse through the real supplies and care packs distributed.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-sm bg-gold text-black text-xs font-semibold hover:bg-gold/90 cursor-pointer transition-colors">
            <ImageIcon className="w-4 h-4" aria-hidden="true" />
            Upload Photo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadFile(file);
                event.target.value = '';
              }}
            />
          </label>
        </div>

        <div className="mt-8 space-y-4">
          {rows.length === 0 && (
            <p className="text-[13px] text-muted/60">No photos yet.</p>
          )}

          {rows.map((row, index) => (
            <div key={row.key} className="flex gap-3 items-start">
              <div className="w-16 h-16 shrink-0 rounded-sm overflow-hidden border border-white/10 bg-black/40">
                {row.url ? (
                  <img src={row.url} alt="" className="w-full h-full object-cover" />
                ) : null}
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                <input
                  value={row.url}
                  onChange={(e) => update(index, { url: e.target.value })}
                  placeholder="https://… image URL"
                  aria-label={`Photo ${index + 1} URL`}
                  className="w-full rounded-sm bg-black/50 border border-white/12 px-3 py-2 text-[12px] text-bone placeholder:text-muted/40 focus:border-gold focus:outline-none transition-colors"
                />
                <input
                  value={row.caption}
                  onChange={(e) => update(index, { caption: e.target.value })}
                  placeholder="Caption (optional)"
                  aria-label={`Photo ${index + 1} caption`}
                  className="w-full rounded-sm bg-black/50 border border-white/12 px-3 py-2 text-[12px] text-bone placeholder:text-muted/40 focus:border-gold focus:outline-none transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={() => persist(rows.filter((_, i) => i !== index))}
                disabled={busy}
                className="p-2 text-muted hover:text-red-400 transition-colors disabled:opacity-40"
                aria-label={`Remove photo ${index + 1}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => setRows([...rows, { key: nextKey(), url: '', caption: '' }])}
          >
            <Plus className="w-4 h-4" />
            Add by URL
          </Button>

          <Button onClick={() => persist(rows.filter((row) => row.url.trim()))} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save gallery
          </Button>
        </div>

        {status && <p className="mt-4 text-[13px] text-emerald-300">{status}</p>}
        {error && (
          <p className="mt-4 text-[13px] text-red-400" role="alert">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
};
