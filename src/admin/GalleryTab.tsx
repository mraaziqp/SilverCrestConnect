/**
 * Gallery editor — the photos shown beside the donation form and across the event.
 *
 * Supports:
 * - Direct image upload to Firebase Storage (with client-side resize)
 * - Adding by URL (hosted images, drive packs, external URLs)
 * - Restoring official default outreach drive photos in 1 click
 * - Browsing photos uploaded throughout the site (e.g. from SME applications) with 1-click "Add to Gallery"
 * - Reordering, editing captions, replacing links, and deleting photos
 * - Persistent database sync so all admins see the exact same gallery
 */

import React, { useEffect, useState } from 'react';
import {
  Image as ImageIcon,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Check,
  Copy,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';

import { Button, Card } from '../components/Brand';
import { api, ApiRequestError } from '../lib/api';
import type { Application, GalleryItem } from '../types';
import { prepareImage, formatBytes } from '../lib/image';
import { MediaCard, moveItem } from './MediaCard';
import { DEFAULT_GALLERY } from '../config/event';

interface GalleryRow {
  key: string;
  url: string;
  caption: string;
}

interface UploadedMediaItem {
  url: string;
  source: string;
  date?: string;
}

let rowCounter = 0;
const nextKey = () => `row-${(rowCounter += 1)}`;

export const GalleryTab: React.FC<{ token: string }> = ({ token }) => {
  const [rows, setRows] = useState<GalleryRow[]>([]);
  const [canUpload, setCanUpload] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  /** How far through a batch upload we are, for the bar below the button. */
  const [progress, setProgress] = useState<{ done: number; total: number; name: string } | null>(null);

  /** Photos discovered from applications across the database. */
  const [sitePhotos, setSitePhotos] = useState<UploadedMediaItem[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  /** Photos held as base64 in the datastore rather than in image storage. */
  const inlineCount = rows.filter((row) => row.url.startsWith('data:')).length;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<{ gallery?: GalleryItem[] }>('/api/event'),
      api<{ available: boolean }>('/api/admin/storage-status', { token }).catch(() => ({ available: false })),
      api<{ applications?: Application[] }>('/api/admin/applications', { token }).catch(() => ({ applications: [] })),
    ])
      .then(([eventRes, storageRes, appsRes]) => {
        const rawGallery = eventRes.gallery;
        const initialGallery: GalleryItem[] =
          rawGallery && rawGallery.length > 0 ? rawGallery : DEFAULT_GALLERY;

        setRows(
          initialGallery.map((item) => ({
            key: nextKey(),
            url: item.url,
            caption: item.caption ?? '',
          })),
        );

        setCanUpload(storageRes.available);

        // Extract photos from applications
        const discovered: UploadedMediaItem[] = [];
        const seenUrls = new Set<string>();

        (appsRes.applications ?? []).forEach((app) => {
          (app.images ?? []).forEach((url: string) => {
            if (url && !seenUrls.has(url)) {
              seenUrls.add(url);
              discovered.push({
                url,
                source: `${app.businessName} (${app.contactName})`,
                date: app.createdAt ? new Date(app.createdAt).toLocaleDateString() : undefined,
              });
            }
          });
        });

        setSitePhotos(discovered);
      })
      .catch(() => {
        setError('Could not load gallery from database. Using default outreach photos.');
        setRows(
          DEFAULT_GALLERY.map((item) => ({
            key: nextKey(),
            url: item.url,
            caption: item.caption ?? '',
          })),
        );
      })
      .finally(() => setLoading(false));
  }, [token]);

  /**
   * Saves the gallery. Resolves to whether it actually saved.
   */
  const persist = async (next: GalleryRow[], announce = true): Promise<boolean> => {
    setBusy(true);
    setError(null);
    if (announce) setStatus(null);
    try {
      await api('/api/admin/gallery', {
        method: 'PUT',
        token,
        body: { items: next.map(({ url, caption }) => ({ url, caption })) },
      });
      setRows(next);
      if (announce) setStatus('Gallery saved to database successfully. All admins and visitors will see this update.');
      return true;
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save the gallery.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  /**
   * Uploads a batch of photos, one at a time, reporting as it goes.
   */
  const uploadFiles = async (files: File[]) => {
    if (!canUpload) {
      setError(
        'Image storage is not connected, so direct file uploads are turned off. Paste a link to the ' +
          'image instead, or enable Firebase Storage in settings.',
      );
      return;
    }
    if (files.length === 0) return;

    setBusy(true);
    setError(null);
    setStatus(null);
    setProgress({ done: 0, total: files.length, name: files[0]?.name ?? '' });

    const added: GalleryRow[] = [];
    const failures: string[] = [];
    let uploadedBytes = 0;

    for (const [index, file] of files.entries()) {
      setProgress({ done: index, total: files.length, name: file.name });
      try {
        const prepared = await prepareImage(file, { maxDimension: 1600, quality: 0.82 });
        const uploaded = await api<{ url: string }>('/api/admin/upload-image', {
          method: 'POST',
          token,
          body: { dataUri: prepared.dataUri, folder: 'gallery' },
        });
        added.push({ key: nextKey(), url: uploaded.url, caption: '' });
        uploadedBytes += prepared.bytes;
      } catch (err) {
        failures.push(`${file.name}: ${err instanceof ApiRequestError ? err.message : (err as Error).message}`);
      }
    }

    setProgress({ done: files.length, total: files.length, name: '' });

    try {
      if (added.length > 0) {
        const saved = await persist([...rows, ...added], false);
        if (saved) {
          setStatus(
            `${added.length} of ${files.length} ${files.length === 1 ? 'photo' : 'photos'} added & saved ` +
              `(${formatBytes(uploadedBytes)}).`,
          );
        } else {
          setRows([...rows, ...added]);
          setStatus(null);
        }
      }
      if (failures.length > 0) {
        setError(
          `${failures.length} ${failures.length === 1 ? 'photo' : 'photos'} could not be added: ` +
            failures.join('; '),
        );
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const update = (index: number, patch: Partial<GalleryRow>) => {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const addFromSite = (url: string, caption = '') => {
    const existing = rows.find((r) => r.url === url);
    if (existing) {
      setStatus('This photo is already in the gallery.');
      return;
    }
    const next = [...rows, { key: nextKey(), url, caption }];
    setRows(next);
    setStatus('Photo added to gallery. Click "Save Gallery" to publish changes.');
  };

  const resetToDefault = () => {
    if (!window.confirm('Reset gallery to the official outreach drive photos? Any unsaved edits will be replaced.')) {
      return;
    }
    const defaultRows = DEFAULT_GALLERY.map((item) => ({
      key: nextKey(),
      url: item.url,
      caption: item.caption ?? '',
    }));
    persist(defaultRows);
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  if (loading) {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-gold mx-auto" />
        <p className="mt-3 text-sm text-muted">Loading photo gallery…</p>
      </Card>
    );
  }

  return (
    <div className="max-w-5xl space-y-8">
      {/* ── Main Gallery Card ── */}
      <Card className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-bold text-bone">Previous Drive Photo Gallery</h3>
              <span className="px-2 py-0.5 rounded-full bg-gold/15 text-gold text-[10px] font-bold tracking-wider uppercase">
                {rows.length} {rows.length === 1 ? 'Photo' : 'Photos'}
              </span>
            </div>
            <p className="mt-2 text-[13px] text-muted leading-relaxed max-w-xl">
              Photos shown beside and around the donation form to show the impact of outreach drives.
              Supporters can browse through real supplies and care packs distributed.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-sm text-xs font-semibold transition-colors ${
                canUpload === false
                  ? 'bg-white/10 text-muted/60 cursor-not-allowed'
                  : 'bg-gold text-black hover:bg-gold/90 cursor-pointer'
              }`}
              title={canUpload === false ? 'Image storage is not connected' : undefined}
            >
              <ImageIcon className="w-4 h-4" aria-hidden="true" />
              {busy && progress ? 'Uploading…' : 'Upload Photos'}
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                disabled={busy || canUpload === false}
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = '';
                  if (files.length) uploadFiles(files);
                }}
              />
            </label>

            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefault}
              disabled={busy}
              title="Restore official outreach photos"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </Button>
          </div>
        </div>

        {progress && (
          <div className="mt-5" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-3 text-[12px] text-muted mb-1.5">
              <span className="truncate">
                {progress.done < progress.total
                  ? `Uploading ${progress.done + 1} of ${progress.total}${progress.name ? ` — ${progress.name}` : ''}`
                  : 'Saving the gallery…'}
              </span>
              <span className="tabular-nums shrink-0">
                {Math.round((progress.done / progress.total) * 100)}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gold transition-[width] duration-300 ease-out"
                style={{ width: `${Math.max(4, Math.round((progress.done / progress.total) * 100))}%` }}
              />
            </div>
          </div>
        )}

        {canUpload === false && (
          <p className="mt-5 rounded-sm border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-200/90 leading-relaxed">
            Image storage bucket is not connected, so direct uploads are off. Paste an image URL or choose from uploaded application photos below.
          </p>
        )}

        {inlineCount > 0 && (
          <p className="mt-4 rounded-sm border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-200/90 leading-relaxed">
            {inlineCount} {inlineCount === 1 ? 'photo is' : 'photos are'} stored in database memory. Replace with image URLs or storage links for fastest load times.
          </p>
        )}

        {/* ── Photo Grid ── */}
        <div className="mt-8">
          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/12 px-6 py-12 text-center">
              <ImageIcon className="w-8 h-8 text-muted/40 mx-auto mb-3" />
              <p className="text-sm font-semibold text-bone">No photos in gallery</p>
              <p className="mt-1 text-[13px] text-muted/70 max-w-sm mx-auto">
                Upload photos, paste an image link, or restore the default drive gallery below.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <Button size="sm" onClick={resetToDefault}>
                  <Sparkles className="w-3.5 h-3.5" />
                  Load Default Drive Photos
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRows([{ key: nextKey(), url: '', caption: '' }])}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add by URL
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((row, index) => (
                <MediaCard
                  key={row.key}
                  url={row.url}
                  label={`Photo ${index + 1}`}
                  badge={index === 0 ? 'Featured (Main)' : undefined}
                  onUrlChange={(url) => update(index, { url })}
                  onRemove={() => persist(rows.filter((_, i) => i !== index))}
                  onMoveLeft={index > 0 ? () => setRows(moveItem(rows, index, index - 1)) : undefined}
                  onMoveRight={
                    index < rows.length - 1 ? () => setRows(moveItem(rows, index, index + 1)) : undefined
                  }
                  disabled={busy}
                >
                  <div className="space-y-1.5">
                    <input
                      value={row.caption}
                      onChange={(e) => update(index, { caption: e.target.value })}
                      placeholder="Caption / description…"
                      aria-label={`Photo ${index + 1} caption`}
                      className="w-full rounded-sm bg-black/50 border border-white/12 px-2.5 py-1.5 text-[12px] text-bone placeholder:text-muted/40 focus:border-gold focus:outline-none transition-colors"
                    />
                    <div className="flex items-center justify-between text-[10px] text-muted/60 pt-0.5">
                      <span>Position: #{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => persist(rows.filter((_, i) => i !== index))}
                        disabled={busy}
                        className="text-red-400 hover:text-red-300 font-semibold transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                </MediaCard>
              ))}
            </div>
          )}

          {rows.length > 1 && (
            <p className="mt-4 text-[11.5px] text-muted/60 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-gold shrink-0" />
              The first photo (#1 Featured) is shown large beside the donation form. Use the arrows to reorder, then click Save Gallery.
            </p>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-white/8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => setRows([...rows, { key: nextKey(), url: '', caption: '' }])}
              disabled={busy}
            >
              <Plus className="w-4 h-4" />
              Add by URL
            </Button>

            <Button onClick={() => persist(rows.filter((row) => row.url.trim()))} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Gallery to Database
            </Button>
          </div>

          <p className="text-xs text-muted/60">
            {rows.filter((r) => r.url.trim()).length} active photos ready to publish
          </p>
        </div>

        {status && (
          <div className="mt-4 p-3 rounded bg-emerald-500/10 border border-emerald-500/30 text-[13px] text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{status}</span>
          </div>
        )}
        {error && (
          <div className="mt-4 p-3 rounded bg-red-500/10 border border-red-500/30 text-[13px] text-red-400" role="alert">
            {error}
          </div>
        )}
      </Card>

      {/* ── Uploaded Photos from Applications Section ── */}
      {sitePhotos.length > 0 && (
        <Card className="p-6 sm:p-8 border border-gold/20 bg-ink-raised">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-gold" />
                <h4 className="font-display text-base font-bold text-bone">
                  Photos Uploaded Across Applications
                </h4>
              </div>
              <p className="mt-1 text-[12.5px] text-muted leading-relaxed max-w-2xl">
                These photos were uploaded by applicants during SME registration. You can click "+ Add to Gallery" on any photo to feature it on the website.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-white/10 text-bone text-xs font-semibold">
              {sitePhotos.length} {sitePhotos.length === 1 ? 'upload' : 'uploads'} found
            </span>
          </div>

          <div className="mt-6 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {sitePhotos.map((item, idx) => {
              const alreadyInGallery = rows.some((r) => r.url === item.url);
              return (
                <div
                  key={idx}
                  className="group rounded-md border border-white/10 bg-black/40 overflow-hidden flex flex-col transition-all hover:border-gold/40"
                >
                  <div className="relative aspect-[4/3] bg-black/60 overflow-hidden">
                    <img
                      src={item.url}
                      alt={item.source}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {alreadyInGallery && (
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-emerald-500/90 text-white text-[9px] font-bold">
                        In Gallery
                      </span>
                    )}
                  </div>

                  <div className="p-2.5 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-[11px] font-semibold text-bone truncate" title={item.source}>
                        {item.source}
                      </p>
                      {item.date && (
                        <p className="text-[10px] text-muted/60">{item.date}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      <Button
                        size="sm"
                        variant={alreadyInGallery ? 'ghost' : 'outline'}
                        onClick={() => addFromSite(item.url, item.source)}
                        disabled={alreadyInGallery || busy}
                        className="w-full text-[11px] py-1 h-7"
                      >
                        {alreadyInGallery ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            Added
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3 text-gold" />
                            Add to Gallery
                          </>
                        )}
                      </Button>

                      <button
                        type="button"
                        onClick={() => copyLink(item.url)}
                        title="Copy image URL"
                        className="p-1.5 rounded bg-white/10 hover:bg-gold/20 text-muted hover:text-gold transition-colors shrink-0"
                      >
                        {copiedUrl === item.url ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};
