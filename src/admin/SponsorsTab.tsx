/**
 * Sponsor editor.
 *
 * Each sponsor carries a placement, and every placement corresponds to a rail
 * that exists in the layout — so a logo can be put anywhere on the page from
 * here, and nothing can be assigned somewhere it would not show.
 *
 * Uploads keep transparency. Sponsor logos arrive as transparent PNGs, and
 * re-encoding one as JPEG would fill the background with black, so the image
 * helper preserves the alpha channel wherever it finds any.
 */

import React, { useEffect, useState } from 'react';
import { Building2, Loader2, Plus, Save, Trash2, Upload } from 'lucide-react';

import { Button, Card } from '../components/Brand';
import { api, ApiRequestError } from '../lib/api';
import { SPONSOR_PLACEMENTS } from '../config/event';
import { prepareImage, formatBytes } from '../lib/image';
import type { Sponsor, SponsorPlacement } from '../types';

interface SponsorRow {
  key: string;
  name: string;
  logoUrl: string;
  websiteUrl: string;
  placement: SponsorPlacement;
}

let rowCounter = 0;
const nextKey = () => `sponsor-${(rowCounter += 1)}`;

export const SponsorsTab: React.FC<{ token: string }> = ({ token }) => {
  const [rows, setRows] = useState<SponsorRow[]>([]);
  const [canUpload, setCanUpload] = useState<boolean | null>(null);
  const [heading, setHeading] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Logos held as base64 in the datastore rather than in image storage. */
  const inlineCount = rows.filter((row) => row.logoUrl.startsWith('data:')).length;

  useEffect(() => {
    api<{ sponsors?: Sponsor[]; event?: { sponsorsHeading?: string } }>('/api/event')
      .then((result) => {
        setRows(
          (result.sponsors ?? []).map((s) => ({
            key: nextKey(),
            name: s.name,
            logoUrl: s.logoUrl,
            websiteUrl: s.websiteUrl ?? '',
            placement: s.placement,
          })),
        );
        setHeading(result.event?.sponsorsHeading ?? '');
      })
      .catch(() => setError('Could not load the current sponsors.'));

    api<{ available: boolean }>('/api/admin/storage-status', { token })
      .then((r) => setCanUpload(r.available))
      .catch(() => setCanUpload(false));
  }, [token]);

  const update = (index: number, patch: Partial<SponsorRow>) => {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const persist = async (next: SponsorRow[]) => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await api('/api/admin/sponsors', {
        method: 'PUT',
        token,
        body: {
          items: next.map(({ name, logoUrl, websiteUrl, placement }) => ({
            name,
            logoUrl,
            websiteUrl,
            placement,
          })),
        },
      });
      setRows(next);
      setStatus('Sponsors saved.');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save the sponsors.');
    } finally {
      setBusy(false);
    }
  };

  const uploadLogo = async (index: number, file: File) => {
    // Same rule as the gallery: a logo that cannot reach storage is refused
    // rather than written into the datastore as base64.
    if (!canUpload) {
      setError(
        'Image storage is not connected, so uploads are turned off. Paste a link to the ' +
          'logo instead, or connect Firebase Storage to upload files directly.',
      );
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      // Smaller than a photo: a logo never needs to be wider than its rail.
      const prepared = await prepareImage(file, { maxDimension: 600 });

      const uploaded = await api<{ url: string }>('/api/admin/upload-image', {
        method: 'POST',
        token,
        body: { dataUri: prepared.dataUri, folder: 'gallery' },
      });
      update(index, { logoUrl: uploaded.url });
      setStatus(`Logo ready (${formatBytes(prepared.bytes)}). Save to publish it.`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : (err as Error).message || 'Could not read that logo.');
    } finally {
      setBusy(false);
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    setRows((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const saveHeading = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('/api/admin/settings', { method: 'PUT', token, body: { sponsorsHeading: heading } });
      setStatus('Caption saved.');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not save the caption.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <Card className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-bone flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gold" aria-hidden="true" />
              Sponsors and partners
            </h3>
            <p className="mt-1.5 text-[12.5px] text-muted leading-relaxed max-w-xl">
              Add a logo and choose where on the page it appears. A placement with no sponsors
              assigned shows nothing at all, so an empty band never appears on the site.
            </p>
          </div>
          <Button onClick={() => persist(rows)} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save sponsors
          </Button>
        </div>

        {error && (
          <div className="mt-5 rounded-sm border border-red-500/40 bg-red-500/10 px-4 py-3" role="alert">
            <p className="text-[13px] text-red-300">{error}</p>
          </div>
        )}
        {status && <p className="mt-5 text-[13px] text-emerald-400">{status}</p>}

        {canUpload === false && (
          <p className="mt-5 rounded-sm border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-200/90 leading-relaxed">
            Image storage is not connected, so the upload button is off. Paste a link to each
            logo for now. Once Firebase Storage is enabled, uploads start working here with no
            further changes.
          </p>
        )}

        {inlineCount > 0 && (
          <p className="mt-4 rounded-sm border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-200/90 leading-relaxed">
            {inlineCount} {inlineCount === 1 ? 'logo is' : 'logos are'} stored inside the database
            rather than in image storage. Every visitor downloads{' '}
            {inlineCount === 1 ? 'it' : 'them'} with the page. Re-upload once storage is
            connected, or replace with a link.
          </p>
        )}

        <div className="mt-7 pt-6 border-t border-white/8">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
            Caption above each sponsor band
          </label>
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder="In partnership with"
              className="flex-1 min-w-[200px] rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
            />
            <Button variant="outline" onClick={saveHeading} disabled={busy}>
              Save caption
            </Button>
          </div>
        </div>

        <div className="mt-7 space-y-5">
          {rows.length === 0 && (
            <p className="text-[13px] text-muted/70">No sponsors yet. Add the first one below.</p>
          )}

          {rows.map((row, index) => (
            <div key={row.key} className="rounded-lg border border-white/10 bg-black/30 p-4 sm:p-5">
              <div className="flex items-start gap-4 flex-wrap sm:flex-nowrap">
                {/* Previewed on a light plate, exactly as the page shows it. */}
                <div className="flex items-center justify-center h-20 w-32 shrink-0 rounded-md bg-white/90 px-3 py-2">
                  {row.logoUrl ? (
                    <img src={row.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider text-black/40">No logo</span>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-3">
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => update(index, { name: e.target.value })}
                    placeholder="Sponsor name"
                    className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
                  />
                  <input
                    type="text"
                    value={row.websiteUrl}
                    onChange={(e) => update(index, { websiteUrl: e.target.value })}
                    placeholder="https://sponsor.co.za  (optional, makes the logo a link)"
                    className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.14em] text-muted mb-1.5">
                        Where it appears
                      </label>
                      <select
                        value={row.placement}
                        onChange={(e) => update(index, { placement: e.target.value as SponsorPlacement })}
                        className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
                      >
                        {SPONSOR_PLACEMENTS.map((p) => (
                          <option key={p.value} value={p.value} className="bg-ink text-bone">
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-muted/60">
                        {SPONSOR_PLACEMENTS.find((p) => p.value === row.placement)?.hint}
                      </p>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.14em] text-muted mb-1.5">
                        Logo
                      </label>
                      <label
                        className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-sm border text-xs font-semibold transition-colors ${
                          canUpload === false
                            ? 'bg-white/5 border-white/10 text-muted/50 cursor-not-allowed'
                            : 'bg-gold/15 border-gold/30 text-gold cursor-pointer hover:bg-gold/25'
                        }`}
                        title={canUpload === false ? 'Image storage is not connected' : undefined}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Upload image
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          className="hidden"
                          disabled={busy || canUpload === false}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadLogo(index, file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <input
                        type="text"
                        value={row.logoUrl.startsWith('data:') ? '' : row.logoUrl}
                        onChange={(e) => update(index, { logoUrl: e.target.value })}
                        placeholder={row.logoUrl.startsWith('data:') ? 'Uploaded image' : 'or paste a logo URL'}
                        className="mt-2 w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2 text-xs text-bone focus:border-gold focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="px-2.5 py-1.5 rounded border border-white/12 text-muted text-xs hover:border-gold/40 hover:text-gold disabled:opacity-30 transition-colors"
                    aria-label="Move earlier"
                  >
                    &uarr;
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === rows.length - 1}
                    className="px-2.5 py-1.5 rounded border border-white/12 text-muted text-xs hover:border-gold/40 hover:text-gold disabled:opacity-30 transition-colors"
                    aria-label="Move later"
                  >
                    &darr;
                  </button>
                  <button
                    type="button"
                    onClick={() => setRows(rows.filter((_, i) => i !== index))}
                    className="px-2.5 py-1.5 rounded border border-red-500/30 text-red-400 text-xs hover:bg-red-500/10 transition-colors"
                    aria-label="Remove sponsor"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          className="mt-6"
          onClick={() =>
            setRows([
              ...rows,
              { key: nextKey(), name: '', logoUrl: '', websiteUrl: '', placement: 'footer' },
            ])
          }
        >
          <Plus className="w-4 h-4" />
          Add sponsor
        </Button>
      </Card>
    </div>
  );
};
