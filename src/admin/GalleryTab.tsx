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
  const [uploadNote, setUploadNote] = useState('');
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

    api<{ available: boolean; note: string }>('/api/admin/storage-status', { token })
      .then((result) => {
        setCanUpload(result.available);
        setUploadNote(result.note);
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

  const uploadFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      // Read as a data URI so the server needs no multipart handling for what
      // amounts to a handful of images.
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read that file.'));
        reader.readAsDataURL(file);
      });

      const uploaded = await api<{ url: string }>('/api/admin/upload-image', {
        method: 'POST',
        token,
        body: { dataUri, folder: 'gallery' },
      });
      await persist([...rows, { key: nextKey(), url: uploaded.url, caption: '' }]);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Upload failed.');
      setBusy(false);
    }
  };

  const update = (index: number, patch: Partial<GalleryRow>) => {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  return (
    <div className="max-w-3xl">
      <Card className="p-6 sm:p-8">
        <h3 className="font-display text-lg font-bold text-bone">Previous drive photos</h3>
        <p className="mt-2 text-[13px] text-muted leading-relaxed">
          Shown beside the donation form, so supporters can see what the last drive achieved.
          The first photo appears large; the rest as thumbnails below it.
        </p>

        {canUpload === false && (
          <div className="mt-5 rounded-sm border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3">
            <p className="text-[13px] text-amber-100/80">{uploadNote}</p>
          </div>
        )}

        {canUpload === true && (
          <label className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-sm border border-white/15 text-[11px] uppercase tracking-[0.12em] text-muted hover:text-gold hover:border-gold/50 cursor-pointer transition-colors">
            <ImageIcon className="w-4 h-4" aria-hidden="true" />
            Upload a photo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadFile(file);
                // Clear it, so choosing the same file twice still fires.
                event.target.value = '';
              }}
            />
          </label>
        )}

        <div className="mt-6 space-y-3">
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
