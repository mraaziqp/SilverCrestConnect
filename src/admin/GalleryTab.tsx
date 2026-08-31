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

  /** Photos held as base64 in the datastore rather than in image storage. */
  const inlineCount = rows.filter((row) => row.url.startsWith('data:')).length;

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

  const uploadFile = async (file: File) => {
    // No silent fallback. An image that cannot go to storage used to be written
    // into the datastore as base64, which put photographs inside the config
    // payload every visitor downloads. Refusing is the honest answer: it says
    // what is wrong and offers the route that does work.
    if (!canUpload) {
      setError(
        'Image storage is not connected, so uploads are turned off. Paste a link to the ' +
          'image instead, or connect Firebase Storage to upload files directly.',
      );
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      // Resize before anything else. A phone photo posted at full size is what
      // made this time out at the gateway.
      const prepared = await prepareImage(file, { maxDimension: 1600, quality: 0.82 });

      const uploaded = await api<{ url: string }>('/api/admin/upload-image', {
        method: 'POST',
        token,
        body: { dataUri: prepared.dataUri, folder: 'gallery' },
      });
      await persist([...rows, { key: nextKey(), url: uploaded.url, caption: '' }]);
      setStatus(`Photo uploaded (${formatBytes(prepared.bytes)}).`);
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

          <label
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-sm text-xs font-semibold transition-colors ${
              canUpload === false
                ? 'bg-white/10 text-muted/60 cursor-not-allowed'
                : 'bg-gold text-black hover:bg-gold/90 cursor-pointer'
            }`}
            title={canUpload === false ? 'Image storage is not connected' : undefined}
          >
            <ImageIcon className="w-4 h-4" aria-hidden="true" />
            Upload Photo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              disabled={busy || canUpload === false}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadFile(file);
                event.target.value = '';
              }}
            />
          </label>
        </div>

        {canUpload === false && (
          <p className="mt-5 rounded-sm border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-200/90 leading-relaxed">
            Image storage is not connected, so the upload button is off. Paste a link to each
            photo for now. Once Firebase Storage is enabled, uploads start working here with no
            further changes.
          </p>
        )}

        {inlineCount > 0 && (
          <p className="mt-4 rounded-sm border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-200/90 leading-relaxed">
            {inlineCount} {inlineCount === 1 ? 'photo is' : 'photos are'} stored inside the
            database rather than in image storage, from before uploads were moved out. Every
            visitor downloads {inlineCount === 1 ? 'it' : 'them'} with the page. Re-upload{' '}
            {inlineCount === 1 ? 'it' : 'them'} once storage is connected, or replace with a link.
          </p>
        )}

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
