/**
 * PayFast & applications dashboard.
 *
 * Access is gated on an ADMIN_TOKEN held by the server; the token entered here
 * is kept in sessionStorage only, so closing the tab logs out. No PayFast
 * secret is ever sent to this page — the merchant key arrives masked.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  HandCoins,
  Image,
  ListChecks,
  Loader2,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sliders,
  Ticket,
  Trash2,
  Users,
} from 'lucide-react';
import { Monogram, Button, Card } from '../components/Brand';
import { GalleryTab } from './GalleryTab';
import { api, ApiRequestError, formatZAR, formatDateTime } from '../lib/api';
import type {
  Application,
  ApplicationStatus,
  DashboardStats,
  EventSettings,
  ImpactItem,
  Payment,
  PayFastConfigStatus,
  ProgrammeItem,
  WelcomePackItem,
} from '../types';

const TOKEN_KEY = 'scc_admin_token';

interface EmailStatus {
  driver: string;
  configured: boolean;
  from: string;
  warnings: string[];
}

interface Overview {
  stats: DashboardStats;
  payfast: PayFastConfigStatus;
  email: EmailStatus;
  storage: { persistent: boolean; note: string };
}

export const AdminDashboard: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));

  const signOut = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  if (!token) {
    return (
      <SignIn
        onSignedIn={(value) => {
          sessionStorage.setItem(TOKEN_KEY, value);
          setToken(value);
        }}
      />
    );
  }

  return <Dashboard token={token} onSignOut={signOut} />;
};

// ------------------------------------------------------------------------ auth

const SignIn: React.FC<{ onSignedIn: (token: string) => void }> = ({ onSignedIn }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Verify before storing, so a wrong token never gets persisted.
      await api('/api/admin/overview', { token: value.trim() });
      onSignedIn(value.trim());
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not sign in.');
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[100svh] flex items-center justify-center px-5">
      <form onSubmit={submit} className="w-full max-w-sm" noValidate>
        <Monogram size={44} className="mx-auto mb-8" />
        <h1 className="font-display text-xl font-bold text-bone text-center">Dashboard access</h1>
        <p className="mt-3 text-[13px] text-muted text-center leading-relaxed">
          Enter the admin token configured on the server.
        </p>

        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="current-password"
          placeholder="Admin token"
          className="mt-7 w-full rounded-sm bg-black/50 border border-white/12 px-4 py-3 text-sm text-bone placeholder:text-muted/40 focus:border-gold focus:outline-none transition-colors"
        />
        {error && (
          <p className="mt-3 text-[13px] text-red-400" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full mt-5" disabled={busy || !value.trim()}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}
        </Button>
      </form>
    </main>
  );
};

// ------------------------------------------------------------------- dashboard

type Tab = 'overview' | 'applications' | 'payments' | 'settings' | 'programme' | 'gallery';

const Dashboard: React.FC<{ token: string; onSignOut: () => void }> = ({ token, onSignOut }) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, a, p] = await Promise.all([
        api<Overview>('/api/admin/overview', { token }),
        api<{ applications: Application[] }>('/api/admin/applications', { token }),
        api<{ payments: Payment[] }>('/api/admin/payments', { token }),
      ]);
      setOverview({ stats: o.stats, payfast: o.payfast, email: o.email, storage: o.storage });
      setApplications(a.applications);
      setPayments(p.payments);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        onSignOut();
        return;
      }
      setError(err instanceof ApiRequestError ? err.message : 'Could not load the dashboard.');
    } finally {
      setLoading(false);
    }
  }, [token, onSignOut]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (id: string, status: ApplicationStatus) => {
    try {
      await api(`/api/admin/applications/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: { status },
        token,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not update that application.');
    }
  };

  /**
   * The CSV route needs the bearer header, so it cannot be a plain link.
   * Fetch it, then hand the browser a blob.
   */
  const downloadCsv = async () => {
    try {
      const res = await fetch('/api/admin/payments.csv', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `silvercrest-payments-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not export the payments CSV.');
    }
  };

  return (
    <div className="min-h-[100svh]">
      {/* Bar */}
      <header className="border-b border-white/8 bg-ink-raised sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Monogram size={28} />
            <div className="min-w-0">
              <p className="font-display text-[12px] uppercase tracking-brand text-bone font-bold truncate">
                Silver Crest Connect
              </p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted/60">Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="p-2 text-muted hover:text-gold transition-colors disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onSignOut}
              className="p-2 text-muted hover:text-gold transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <nav className="max-w-7xl mx-auto px-5 sm:px-8 flex gap-1 -mb-px overflow-x-auto whitespace-nowrap scrollbar-none" aria-label="Dashboard sections">
          {(
            [
              ['overview', 'Overview'],
              ['applications', `Applications (${applications.length})`],
              ['payments', `Payments (${payments.length})`],
              ['settings', 'Settings & Branding'],
              ['programme', 'Programme & Broadcast'],
              ['gallery', 'Photo Gallery'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={[
                'px-4 py-3 text-[11px] uppercase tracking-[0.14em] font-semibold border-b-2 transition-colors',
                tab === key
                  ? 'border-gold text-gold'
                  : 'border-transparent text-muted hover:text-bone',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
        {error && (
          <div className="mb-6 rounded-sm border border-red-500/40 bg-red-500/10 px-4 py-3" role="alert">
            <p className="text-[13px] text-red-300">{error}</p>
          </div>
        )}

        {loading && !overview ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-gold animate-spin" />
          </div>
        ) : (
          <>
            {tab === 'overview' && overview && <OverviewTab overview={overview} />}
            {tab === 'applications' && (
              <ApplicationsTab applications={applications} onUpdate={updateStatus} />
            )}
            {tab === 'payments' && <PaymentsTab payments={payments} onExport={downloadCsv} />}
            {tab === 'settings' && <SettingsTab token={token} onSaved={load} />}
            {tab === 'gallery' && <GalleryTab token={token} />}
            {tab === 'programme' && (
              <ProgrammeTab
                token={token}
                paidAttendeesCount={applications.filter((a) => a.status === 'PAID').length}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};

// --------------------------------------------------------------------- tabs

const OverviewTab: React.FC<{ overview: Overview }> = ({ overview }) => {
  const { stats, payfast, email, storage } = overview;
  const allWarnings = [...payfast.warnings, ...email.warnings];

  return (
    <div className="space-y-8">
      {/* Warnings first — a misconfigured gateway is the thing that costs money. */}
      {(allWarnings.length > 0 || !storage.persistent) && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-amber-200">Configuration warnings</h3>
              <ul className="mt-3 space-y-2">
                {!storage.persistent && (
                  <li className="text-[13px] text-amber-100/80 leading-relaxed">• {storage.note}</li>
                )}
                {allWarnings.map((warning) => (
                  <li key={warning} className="text-[13px] text-amber-100/80 leading-relaxed">
                    • {warning}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Money */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<Banknote className="w-4 h-4" />}
          label="Total raised"
          value={formatZAR(stats.totalRaisedZAR)}
          sub={`${formatZAR(stats.netRaisedZAR)} net of fees`}
          featured
        />
        <Stat
          icon={<Ticket className="w-4 h-4" />}
          label="Tickets sold"
          value={String(stats.ticketsSold)}
          sub={`${formatZAR(stats.ticketsRevenueZAR)} · ${stats.seatsRemaining} of ${stats.capacity} seats left`}
        />
        <Stat
          icon={<HandCoins className="w-4 h-4" />}
          label="Donations"
          value={String(stats.donationsCount)}
          sub={formatZAR(stats.donationsRevenueZAR)}
        />
        <Stat
          icon={<Users className="w-4 h-4" />}
          label="Awaiting review"
          value={String(stats.applications.PENDING_REVIEW)}
          sub={`${stats.applications.APPROVED} approved · ${stats.applications.PAID} paid`}
        />
      </div>

      {/* PayFast configuration */}
      <Card className="p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h3 className="font-display text-lg font-bold text-bone">PayFast configuration</h3>
          <span
            className={[
              'inline-flex items-center gap-2 px-3 py-1 rounded-sm text-[10px] uppercase tracking-[0.14em] font-semibold border',
              payfast.configured
                ? 'border-gold/40 text-gold bg-gold/8'
                : 'border-amber-500/40 text-amber-300 bg-amber-500/8',
            ].join(' ')}
          >
            {payfast.configured ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            {payfast.configured ? 'Credentials loaded' : 'Not configured'}
          </span>
        </div>

        <p className="mt-4 text-[13px] text-muted leading-relaxed">
          These values are set as environment variables on the server. The merchant key and
          passphrase are never sent to this page — the key below is masked at source.
        </p>

        <dl className="mt-7 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <ConfigRow label="Mode" value={payfast.mode === 'live' ? 'Live' : 'Sandbox (test)'} highlight={payfast.mode === 'live'} />
          <ConfigRow label="Merchant ID" value={payfast.merchantId} mono />
          <ConfigRow label="Merchant Key" value={payfast.merchantKeyMasked} mono />
          <ConfigRow label="Passphrase" value={payfast.passphraseSet ? 'Set' : 'Not set'} />
          <ConfigRow label="Process URL" value={payfast.processUrl} mono span />
          <ConfigRow label="ITN / Notify URL" value={payfast.notifyUrl} mono span />
          <ConfigRow label="Return URL" value={payfast.returnUrl} mono span />
          <ConfigRow label="Cancel URL" value={payfast.cancelUrl} mono span />
        </dl>
      </Card>

      {/* Email delivery */}
      <Card className="p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h3 className="font-display text-lg font-bold text-bone">Email delivery</h3>
          <span
            className={[
              'inline-flex items-center gap-2 px-3 py-1 rounded-sm text-[10px] uppercase tracking-[0.14em] font-semibold border',
              email.configured
                ? 'border-gold/40 text-gold bg-gold/8'
                : 'border-amber-500/40 text-amber-300 bg-amber-500/8',
            ].join(' ')}
          >
            {email.configured ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            {email.configured ? 'Sending live' : 'Console only'}
          </span>
        </div>

        <p className="mt-4 text-[13px] text-muted leading-relaxed">
          Applicants are emailed automatically at three points: on application, on approval (with
          the payment link), and when payment clears. Donors get a receipt.
        </p>

        <dl className="mt-7 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <ConfigRow label="Driver" value={email.driver === 'resend' ? 'Resend' : 'Console (not delivered)'} highlight={!email.configured} />
          <ConfigRow label="From" value={email.from} mono />
        </dl>
      </Card>
    </div>
  );
};

const ApplicationsTab: React.FC<{
  applications: Application[];
  onUpdate: (id: string, status: ApplicationStatus) => void;
}> = ({ applications, onUpdate }) => {
  const [filter, setFilter] = useState<ApplicationStatus | 'ALL'>('ALL');

  // The curation rule is 1-2 *businesses* per category, so this counts
  // businesses. Counting attendees instead made a single two-representative
  // booking read as "2/2 booked" and flag the sector full, which would turn
  // away the second, genuinely different business the rule exists to admit.
  const industryStats = useMemo(() => {
    const map: Record<string, { approvedOrPaid: number; pending: number }> = {};
    for (const app of applications) {
      const ind = (app.industry || 'General').trim();
      if (!map[ind]) map[ind] = { approvedOrPaid: 0, pending: 0 };
      if (app.status === 'APPROVED' || app.status === 'PAID') {
        map[ind].approvedOrPaid += 1;
      } else if (app.status === 'PENDING_REVIEW') {
        map[ind].pending += 1;
      }
    }
    return Object.entries(map).sort((a, b) => b[1].approvedOrPaid - a[1].approvedOrPaid);
  }, [applications]);

  const visible = filter === 'ALL' ? applications : applications.filter((a) => a.status === filter);

  if (applications.length === 0) {
    return <Empty message="No applications yet." />;
  }

  return (
    <div>
      {/* Category / Industry Slot Tracker (Target: 1-2 per category) */}
      <div className="mb-6 rounded-lg border border-gold/25 bg-ink-raised/70 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h4 className="text-xs uppercase tracking-brand text-gold font-bold">
              Industry Slot Tracker (Target: 1–2 Businesses Per Category)
            </h4>
            <p className="mt-1 text-[12px] text-muted">
              Monitoring confirmed spots per sector to prevent oversaturation and ensure diverse networking.
            </p>
          </div>
          <span className="text-[11px] text-muted/70">
            {industryStats.length} active sectors
          </span>
        </div>

        {industryStats.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {industryStats.map(([industry, stats]: [string, { approvedOrPaid: number; pending: number }]) => {
              const full = stats.approvedOrPaid >= 2;
              const near = stats.approvedOrPaid === 1;
              return (
                <div
                  key={industry}
                  className={`px-3 py-1.5 rounded-md border text-xs flex items-center gap-2 ${
                    full
                      ? 'border-red-500/50 bg-red-500/10 text-red-300'
                      : near
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
                      : 'border-white/12 bg-black/40 text-bone'
                  }`}
                >
                  <span className="font-medium">{industry}:</span>
                  <span className="font-bold">{stats.approvedOrPaid}/2 businesses</span>
                  {stats.pending > 0 && (
                    <span className="text-[10px] text-muted">({stats.pending} pending)</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {(['ALL', 'PENDING_REVIEW', 'APPROVED', 'PAID', 'WAITLISTED', 'REJECTED'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={[
              'px-3 py-1.5 rounded-sm text-[10px] uppercase tracking-[0.12em] font-semibold border transition-colors',
              filter === key
                ? 'border-gold text-gold bg-gold/8'
                : 'border-white/12 text-muted hover:text-bone',
            ].join(' ')}
          >
            {key.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {visible.map((app) => (
          <Card key={app.id} className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-[16px] font-bold text-bone">{app.businessName}</h3>
                  <StatusPill status={app.status} />
                  <span className="font-mono text-[11px] text-gold">{app.reference}</span>
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] uppercase font-bold text-gold">
                    {app.attendeeCount === 2 ? `2 Reps (${formatZAR(app.totalPriceZAR || 700)})` : `1 Rep (${formatZAR(app.totalPriceZAR || 350)})`}
                  </span>
                </div>

                <p className="mt-2 text-[13.5px] text-bone font-medium">
                  {app.contactName}{' '}
                  {app.applicantRole && (
                    <span className="text-xs text-muted font-normal">({app.applicantRole})</span>
                  )}{' '}
                  · <span className="text-gold font-normal">{app.industry}</span>
                </p>

                <p className="mt-1 text-[12px] text-muted/70">
                  {app.email} · {app.phone}
                  {app.registrationNumber && ` · CIPC: ${app.registrationNumber}`}
                </p>

                {app.website && (
                  <a
                    href={app.website.startsWith('http') ? app.website : `https://${app.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-[12px] text-gold hover:underline break-all"
                  >
                    {app.website}
                  </a>
                )}

                {/* Second Attendee Info if 2 representatives */}
                {app.attendeeCount === 2 && (app.rep2Name || app.rep2Email) && (
                  <div className="mt-3 p-3 rounded bg-black/40 border border-white/10 text-xs">
                    <p className="font-semibold text-gold uppercase tracking-wider text-[10px]">
                      Second Representative:
                    </p>
                    <p className="mt-1 text-bone">
                      {app.rep2Name} {app.rep2Role && `(${app.rep2Role})`} · {app.rep2Email} · {app.rep2Phone}
                    </p>
                  </div>
                )}

                <div className="mt-3.5 space-y-2 border-t border-white/5 pt-3">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-muted font-semibold">About the Business:</span>
                    <p className="mt-0.5 text-[13px] text-muted leading-relaxed">{app.about}</p>
                  </div>

                  {app.productsServices && (
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">Products &amp; Services:</span>
                      <p className="mt-0.5 text-[13px] text-bone/90 leading-relaxed">{app.productsServices}</p>
                    </div>
                  )}

                  {app.communityContribution && (
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-gold font-semibold">Community Value &amp; Network:</span>
                      <p className="mt-0.5 text-[13px] text-bone/90 leading-relaxed">{app.communityContribution}</p>
                    </div>
                  )}

                  {app.lookingFor && (
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-muted font-semibold">Looking for from Connect:</span>
                      <p className="mt-0.5 text-[12.5px] text-muted/80 leading-relaxed">{app.lookingFor}</p>
                    </div>
                  )}
                </div>

                {app.ticketCode && (
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded bg-gold/10 border border-gold/30">
                    <span className="text-xs uppercase text-gold font-bold">Confirmed Ticket Code:</span>
                    <span className="font-mono text-sm font-bold text-bone">{app.ticketCode}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-stretch gap-2 shrink-0 w-full sm:w-auto">
                <p className="text-[11px] text-muted/50 sm:text-right">
                  {formatDateTime(app.createdAt)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {app.status !== 'APPROVED' && app.status !== 'PAID' && (
                    <MiniButton onClick={() => onUpdate(app.id, 'APPROVED')}>Approve</MiniButton>
                  )}
                  {app.status !== 'WAITLISTED' && app.status !== 'PAID' && (
                    <MiniButton onClick={() => onUpdate(app.id, 'WAITLISTED')}>Waitlist</MiniButton>
                  )}
                  {app.status !== 'PAID' && (
                    <MiniButton onClick={() => onUpdate(app.id, 'PAID')} title="Use for EFT or cash payments taken outside PayFast">
                      Mark paid
                    </MiniButton>
                  )}
                  {app.status !== 'REJECTED' && (
                    <MiniButton danger onClick={() => onUpdate(app.id, 'REJECTED')}>
                      Reject
                    </MiniButton>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const PaymentsTab: React.FC<{ payments: Payment[]; onExport: () => void }> = ({
  payments,
  onExport,
}) => {
  if (payments.length === 0) {
    return <Empty message="No payments yet." />;
  }

  return (
    <div>
      <div className="flex justify-end mb-5">
        <Button variant="outline" onClick={onExport}>
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/8">
        <table className="w-full text-left border-collapse min-w-[820px]">
          <thead>
            <tr className="bg-ink-raised">
              {['Reference', 'Type', 'Payer', 'Amount', 'Status', 'PayFast ID', 'Date'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-[10px] uppercase tracking-[0.14em] text-muted font-semibold whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {payments.map((p) => (
              <tr key={p.id} className="bg-ink-raised/40 hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 font-mono text-[12px] text-gold whitespace-nowrap">
                  {p.reference}
                </td>
                <td className="px-4 py-3 text-[12px] text-muted">{p.kind}</td>
                <td className="px-4 py-3 text-[12px] text-bone">
                  <div>{p.anonymous ? 'Anonymous' : p.name}</div>
                  <div className="text-muted/60 text-[11px]">{p.email}</div>
                </td>
                <td className="px-4 py-3 text-[13px] text-bone font-semibold whitespace-nowrap">
                  {formatZAR(p.amountZAR, true)}
                  {p.feeZAR !== undefined && (
                    <div className="text-[11px] text-muted/60 font-normal">
                      fee {formatZAR(p.feeZAR, true)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <PaymentPill status={p.status} />
                  {p.itnError && (
                    <div className="mt-1 text-[11px] text-red-400 max-w-[220px]" title={p.itnError}>
                      {p.itnError}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted/70 whitespace-nowrap">
                  {p.pfPaymentId ?? '—'}
                </td>
                <td className="px-4 py-3 text-[11px] text-muted/60 whitespace-nowrap">
                  {formatDateTime(p.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------- fragments

const Stat: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  featured?: boolean;
}> = ({ icon, label, value, sub, featured }) => (
  <Card featured={featured} className="p-5">
    <div className="flex items-center gap-2 text-gold">{icon}</div>
    <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
    <p className="mt-1.5 font-display text-2xl font-bold text-bone">{value}</p>
    {sub && <p className="mt-1.5 text-[11px] text-muted/60">{sub}</p>}
  </Card>
);

const ConfigRow: React.FC<{
  label: string;
  value: string;
  mono?: boolean;
  span?: boolean;
  highlight?: boolean;
}> = ({ label, value, mono, span, highlight }) => (
  <div className={span ? 'sm:col-span-2' : ''}>
    <dt className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</dt>
    <dd
      className={[
        'mt-1.5 text-[13px] break-all',
        mono ? 'font-mono' : '',
        highlight ? 'text-gold font-semibold' : 'text-bone',
      ].join(' ')}
    >
      {value}
    </dd>
  </div>
);

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  PENDING_REVIEW: 'border-white/20 text-muted',
  APPROVED: 'border-gold/40 text-gold bg-gold/8',
  PAID: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/8',
  WAITLISTED: 'border-amber-500/40 text-amber-300 bg-amber-500/8',
  REJECTED: 'border-red-500/40 text-red-300 bg-red-500/8',
};

const StatusPill: React.FC<{ status: ApplicationStatus }> = ({ status }) => (
  <span
    className={`px-2 py-0.5 rounded-sm border text-[9px] uppercase tracking-[0.14em] font-semibold ${STATUS_STYLES[status]}`}
  >
    {status.replace('_', ' ')}
  </span>
);

const PAYMENT_STYLES: Record<string, string> = {
  COMPLETE: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/8',
  PENDING: 'border-white/20 text-muted',
  FAILED: 'border-red-500/40 text-red-300 bg-red-500/8',
  CANCELLED: 'border-amber-500/40 text-amber-300 bg-amber-500/8',
};

const PaymentPill: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`px-2 py-0.5 rounded-sm border text-[9px] uppercase tracking-[0.14em] font-semibold whitespace-nowrap ${
      PAYMENT_STYLES[status] ?? 'border-white/20 text-muted'
    }`}
  >
    {status}
  </span>
);

const MiniButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  title?: string;
}> = ({ children, onClick, danger, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={[
      'px-3 py-1.5 rounded-sm text-[10px] uppercase tracking-[0.12em] font-semibold border transition-colors',
      danger
        ? 'border-red-500/30 text-red-300 hover:bg-red-500/10'
        : 'border-white/15 text-muted hover:text-gold hover:border-gold/50',
    ].join(' ')}
  >
    {children}
  </button>
);

const Empty: React.FC<{ message: string }> = ({ message }) => (
  <div className="py-24 text-center">
    <p className="text-[14px] text-muted">{message}</p>
  </div>
);

// -------------------------------------------------------- settings & branding tab

const SettingsTab: React.FC<{ token: string; onSaved: () => void }> = ({ token, onSaved }) => {
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [welcomePack, setWelcomePack] = useState<WelcomePackItem[]>([]);
  const [impactItems, setImpactItems] = useState<ImpactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api<{
      settings: EventSettings;
      welcomePack: WelcomePackItem[];
      impactItems: ImpactItem[];
    }>('/api/admin/settings', { token })
      .then((res) => {
        setSettings(res.settings);
        setWelcomePack(res.welcomePack ?? []);
        setImpactItems(res.impactItems ?? []);
      })
      .catch((err) => {
        setError(err instanceof ApiRequestError ? err.message : 'Could not load event settings.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo image must be smaller than 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setSettings((prev) => (prev ? { ...prev, customLogoUrl: result } : null));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSuccess(null);
    setError(null);

    try {
      await Promise.all([
        api('/api/admin/settings', { method: 'PUT', body: settings, token }),
        api('/api/admin/welcome-pack', { method: 'PUT', body: { items: welcomePack }, token }),
        api('/api/admin/impact-items', { method: 'PUT', body: { items: impactItems }, token }),
      ]);
      setSuccess('Event settings, welcome pack, and branding updated successfully!');
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-gold animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-8 max-w-5xl">
      {success && (
        <div className="rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-5 py-4 text-emerald-300 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="rounded-sm border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-300 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Capacity & Tickets */}
      <Card className="p-7 sm:p-9">
        <div className="flex items-center gap-3 mb-6">
          <Sliders className="w-5 h-5 text-gold" />
          <h3 className="font-display text-lg font-bold text-bone">Capacity &amp; Ticket Pricing</h3>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-brand text-gold font-semibold mb-3">Event Capacity</h4>
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
                Total Seats (Capacity)
              </label>
              <input
                type="number"
                min="1"
                value={settings.capacity}
                onChange={(e) => setSettings({ ...settings, capacity: parseInt(e.target.value) || 0 })}
                className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone font-mono focus:border-gold focus:outline-none"
                required
              />
              <p className="mt-1 text-[11px] text-muted/60">Hard capacity ceiling (e.g. 50)</p>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
                Min Seats Target
              </label>
              <input
                type="number"
                min="1"
                value={settings.capacityMin}
                onChange={(e) => setSettings({ ...settings, capacityMin: parseInt(e.target.value) || 0 })}
                className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone font-mono focus:border-gold focus:outline-none"
                required
              />
              <p className="mt-1 text-[11px] text-muted/60">e.g. 40</p>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
                Max Seats Target
              </label>
              <input
                type="number"
                min="1"
                value={settings.capacityMax}
                onChange={(e) => setSettings({ ...settings, capacityMax: parseInt(e.target.value) || 0 })}
                className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone font-mono focus:border-gold focus:outline-none"
                required
              />
              <p className="mt-1 text-[11px] text-muted/60">e.g. 50</p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10">
          <h4 className="text-xs uppercase tracking-brand text-gold font-semibold mb-3">Attendance &amp; Representative Pricing</h4>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
                Primary Booking Fee (ZAR)
              </label>
              <input
                type="number"
                min="0"
                value={settings.ticketPriceZAR}
                onChange={(e) => setSettings({ ...settings, ticketPriceZAR: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone font-mono focus:border-gold focus:outline-none"
                required
              />
              <p className="mt-1 text-[11px] text-muted/60">Base fee charged for primary business application (e.g. R350)</p>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
                Additional Representative / Employee Fee (ZAR)
              </label>
              <input
                type="number"
                min="0"
                value={settings.additionalRepPriceZAR ?? settings.ticketPriceZAR}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    additionalRepPriceZAR: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone font-mono focus:border-gold focus:outline-none"
                required
              />
              <p className="mt-1 text-[11px] text-muted/60">
                Additional fee added when bringing a 2nd representative/co-worker (e.g. R350)
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Date, Time & Venue */}
      <Card className="p-7 sm:p-9">
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="w-5 h-5 text-gold" />
          <h3 className="font-display text-lg font-bold text-bone">Date, Time &amp; Venue</h3>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Event Date (YYYY-MM-DD)
            </label>
            <input
              type="date"
              value={settings.date}
              onChange={(e) => {
                const d = e.target.value;
                setSettings({
                  ...settings,
                  date: d,
                  startsAtISO: `${d}T${settings.startTime || '09:00'}:00+02:00`,
                });
              }}
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone font-mono focus:border-gold focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Date Label (Display)
            </label>
            <input
              type="text"
              value={settings.dateLabel}
              onChange={(e) => setSettings({ ...settings, dateLabel: e.target.value })}
              placeholder="23 October 2026"
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Time Label (Display)
            </label>
            <input
              type="text"
              value={settings.timeLabel}
              onChange={(e) => setSettings({ ...settings, timeLabel: e.target.value })}
              placeholder="09:00 – 13:00"
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Countdown Target ISO
            </label>
            <input
              type="text"
              value={settings.startsAtISO}
              onChange={(e) => setSettings({ ...settings, startsAtISO: e.target.value })}
              placeholder="2026-10-23T09:00:00+02:00"
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone font-mono focus:border-gold focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Venue Name
            </label>
            <input
              type="text"
              value={settings.venue}
              onChange={(e) => setSettings({ ...settings, venue: e.target.value })}
              placeholder="Venue to be confirmed"
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Venue Location / City
            </label>
            <input
              type="text"
              value={settings.venueCity}
              onChange={(e) => setSettings({ ...settings, venueCity: e.target.value })}
              placeholder="Cape Town, South Africa"
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
            />
          </div>
        </div>
      </Card>

      {/* 3. Branding, Logo & Company Details */}
      <Card className="p-7 sm:p-9">
        <div className="flex items-center gap-3 mb-6">
          <Image className="w-5 h-5 text-gold" />
          <h3 className="font-display text-lg font-bold text-bone">Brand, Logo &amp; Company Info</h3>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Event Full Name
            </label>
            <input
              type="text"
              value={settings.fullName}
              onChange={(e) => setSettings({ ...settings, fullName: e.target.value })}
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Company Name
            </label>
            <input
              type="text"
              value={settings.companyName}
              onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Company Website Link
            </label>
            <input
              type="url"
              value={settings.companyWebsite}
              onChange={(e) => setSettings({ ...settings, companyWebsite: e.target.value })}
              placeholder="https://scconsults.co.za"
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone font-mono focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Contact Email
            </label>
            <input
              type="email"
              value={settings.contactEmail}
              onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
              placeholder="connect@scconsults.co.za"
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone font-mono focus:border-gold focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Custom Logo (Upload image or leave blank for official Vector Emblem)
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="text-xs text-muted file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-xs file:font-semibold file:bg-gold file:text-black hover:file:bg-gold/90 cursor-pointer"
              />
              {settings.customLogoUrl && (
                <div className="flex items-center gap-3">
                  <img
                    src={settings.customLogoUrl}
                    alt="Custom Logo"
                    className="h-10 max-w-[120px] object-contain bg-black/80 p-1 rounded border border-gold/40"
                  />
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, customLogoUrl: '' })}
                    className="text-xs text-red-400 hover:text-red-300 underline"
                  >
                    Reset to Default Logo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* 4. Paragraphs & Content Copy */}
      <Card className="p-7 sm:p-9">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-5 h-5 text-gold" />
          <h3 className="font-display text-lg font-bold text-bone">Paragraphs &amp; Copy</h3>
        </div>
        <div className="space-y-6">
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Tagline Banner
            </label>
            <input
              type="text"
              value={settings.tagline}
              onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Hero Lead Paragraph
            </label>
            <textarea
              rows={3}
              value={settings.heroParagraph}
              onChange={(e) => setSettings({ ...settings, heroParagraph: e.target.value })}
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              About Section Heading
            </label>
            <input
              type="text"
              value={settings.aboutTitle}
              onChange={(e) => setSettings({ ...settings, aboutTitle: e.target.value })}
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              About Section Lead Story
            </label>
            <textarea
              rows={3}
              value={settings.aboutLead}
              onChange={(e) => setSettings({ ...settings, aboutLead: e.target.value })}
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              About Section Body Details
            </label>
            <textarea
              rows={2}
              value={settings.aboutBody}
              onChange={(e) => setSettings({ ...settings, aboutBody: e.target.value })}
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Presented By
            </label>
            <input
              type="text"
              value={settings.presentedBy || ''}
              onChange={(e) => setSettings({ ...settings, presentedBy: e.target.value })}
              placeholder="Silver Crest Executive Management Consulting"
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Contact Phone / WhatsApp
            </label>
            <input
              type="tel"
              value={settings.contactPhone || ''}
              onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
              placeholder="+27 ..."
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Community Outreach Cause (Full Name)
            </label>
            <input
              type="text"
              value={settings.cause || ''}
              onChange={(e) => setSettings({ ...settings, cause: e.target.value })}
              placeholder="Silver Crest's Year-End Community Outreach Drive"
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Community Outreach Cause (Short Name)
            </label>
            <input
              type="text"
              value={settings.causeShort || ''}
              onChange={(e) => setSettings({ ...settings, causeShort: e.target.value })}
              placeholder="Year-End Community Outreach Drive"
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Donation Gallery Eyebrow Heading
            </label>
            <input
              type="text"
              value={settings.galleryHeading || ''}
              onChange={(e) => setSettings({ ...settings, galleryHeading: e.target.value })}
              placeholder="Where Your Donations Go"
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Donation Gallery Lead Description
            </label>
            <textarea
              rows={2}
              value={settings.galleryBody || ''}
              onChange={(e) => setSettings({ ...settings, galleryBody: e.target.value })}
              placeholder="Real supplies, care parcels, and winter warmth kits prepared and distributed to local families."
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Footer Note ("Where your money goes")
            </label>
            <textarea
              rows={2}
              value={settings.footerNote}
              onChange={(e) => setSettings({ ...settings, footerNote: e.target.value })}
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Copyright Footer Notice
            </label>
            <input
              type="text"
              value={settings.copyrightText || ''}
              onChange={(e) => setSettings({ ...settings, copyrightText: e.target.value })}
              placeholder="Silver Crest Connect. All rights reserved."
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
            />
          </div>
        </div>
      </Card>

      {/* 5. What's Included (Welcome Pack) */}
      <Card className="p-7 sm:p-9">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-gold" />
            <h3 className="font-display text-lg font-bold text-bone">What Every Registered SME Receives</h3>
          </div>
          <button
            type="button"
            onClick={() => setWelcomePack([...welcomePack, { title: 'New Item', body: 'Item description' }])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-gold/40 text-gold text-xs font-semibold hover:bg-gold/10 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Item
          </button>
        </div>

        <div className="space-y-4">
          {welcomePack.map((item, idx) => (
            <div key={idx} className="p-4 rounded border border-white/10 bg-black/30 flex items-start gap-4">
              <div className="flex-1 grid gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => {
                    const copy = [...welcomePack];
                    copy[idx].title = e.target.value;
                    setWelcomePack(copy);
                  }}
                  placeholder="Item Title"
                  className="rounded-sm bg-black/60 border border-white/15 px-3 py-2 text-sm text-bone focus:border-gold focus:outline-none"
                />
                <input
                  type="text"
                  value={item.body}
                  onChange={(e) => {
                    const copy = [...welcomePack];
                    copy[idx].body = e.target.value;
                    setWelcomePack(copy);
                  }}
                  placeholder="Item Description"
                  className="sm:col-span-2 rounded-sm bg-black/60 border border-white/15 px-3 py-2 text-sm text-bone focus:border-gold focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setWelcomePack(welcomePack.filter((_, i) => i !== idx))}
                className="p-2 text-red-400 hover:text-red-300"
                title="Delete Item"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* 6. On-Site Impact Stand Items */}
      <Card className="p-7 sm:p-9">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <HandCoins className="w-5 h-5 text-gold" />
            <h3 className="font-display text-lg font-bold text-bone">On-The-Day Impact Stand Items</h3>
          </div>
          <button
            type="button"
            onClick={() => setImpactItems([...impactItems, { title: 'New Impact Feature', body: 'Description' }])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-gold/40 text-gold text-xs font-semibold hover:bg-gold/10 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Impact Item
          </button>
        </div>

        <div className="space-y-4">
          {impactItems.map((item, idx) => (
            <div key={idx} className="p-4 rounded border border-white/10 bg-black/30 flex items-start gap-4">
              <div className="flex-1 grid gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => {
                    const copy = [...impactItems];
                    copy[idx].title = e.target.value;
                    setImpactItems(copy);
                  }}
                  placeholder="Title"
                  className="rounded-sm bg-black/60 border border-white/15 px-3 py-2 text-sm text-bone focus:border-gold focus:outline-none"
                />
                <input
                  type="text"
                  value={item.body}
                  onChange={(e) => {
                    const copy = [...impactItems];
                    copy[idx].body = e.target.value;
                    setImpactItems(copy);
                  }}
                  placeholder="Description"
                  className="sm:col-span-2 rounded-sm bg-black/60 border border-white/15 px-3 py-2 text-sm text-bone focus:border-gold focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setImpactItems(impactItems.filter((_, i) => i !== idx))}
                className="p-2 text-red-400 hover:text-red-300"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <div className="sticky bottom-6 z-30 pt-4 flex justify-end">
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Saving Changes…
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> Save All Settings
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

// -------------------------------------------------------- programme & broadcast tab

const ProgrammeTab: React.FC<{ token: string; paidAttendeesCount: number }> = ({
  token,
  paidAttendeesCount,
}) => {
  const [programme, setProgramme] = useState<ProgrammeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [customMsg, setCustomMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadProgramme = useCallback(() => {
    setLoading(true);
    api<{ programme: ProgrammeItem[] }>('/api/admin/settings', { token })
      .then((res) => {
        setProgramme(res.programme ?? []);
      })
      .catch((err) => {
        setErrorMsg(err instanceof ApiRequestError ? err.message : 'Could not load programme.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    loadProgramme();
  }, [loadProgramme]);

  const saveProgramme = async () => {
    setSaving(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await api('/api/admin/programme', {
        method: 'PUT',
        body: { items: programme },
        token,
      });
      setStatusMsg('Programme schedule updated successfully!');
    } catch (err) {
      setErrorMsg(err instanceof ApiRequestError ? err.message : 'Failed to save programme.');
    } finally {
      setSaving(false);
    }
  };

  const broadcastEmail = async () => {
    if (paidAttendeesCount === 0) {
      setErrorMsg('No paid attendees found to email yet.');
      return;
    }
    if (!window.confirm(`Are you sure you want to email the latest programme to all ${paidAttendeesCount} paid attendees?`)) {
      return;
    }

    setBroadcasting(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await api<{ sentCount: number; message: string }>('/api/admin/programme/broadcast', {
        method: 'POST',
        body: { message: customMsg },
        token,
      });
      setStatusMsg(res.message);
      setCustomMsg('');
    } catch (err) {
      setErrorMsg(err instanceof ApiRequestError ? err.message : 'Failed to dispatch broadcast.');
    } finally {
      setBroadcasting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {statusMsg && (
        <div className="rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-5 py-4 text-emerald-300 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-sm border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-300 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Manual Broadcast Card */}
      <Card featured className="p-7 sm:p-9 bg-ink-raised border-gold/40">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 text-gold mb-2">
              <Send className="w-5 h-5" />
              <span className="text-[11px] uppercase tracking-brand font-semibold">Manual Email Dispatch</span>
            </div>
            <h3 className="font-display text-xl font-bold text-bone">
              Broadcast Programme to Paid Attendees
            </h3>
            <p className="mt-2 text-[13.5px] text-muted max-w-2xl leading-relaxed">
              Send the latest up-to-date agenda directly to confirmed &amp; paid attendees’ inboxes whenever the schedule changes.
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-gold font-mono">{paidAttendeesCount}</span>
            <p className="text-[11px] text-muted/70 uppercase tracking-wider">Paid Attendees</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-2 font-semibold">
              Optional Announcement Note / Message from Wesley
            </label>
            <textarea
              rows={2}
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
              placeholder="e.g. Here is our finalized keynote list for the event. See you on the 23rd of October!"
              className="w-full rounded-sm bg-black/60 border border-white/15 px-3.5 py-2.5 text-sm text-bone focus:border-gold focus:outline-none"
            />
          </div>

          <Button
            type="button"
            onClick={broadcastEmail}
            disabled={broadcasting || paidAttendeesCount === 0}
            className="w-full sm:w-auto"
          >
            {broadcasting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Dispatching Emails…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Send Programme Update to {paidAttendeesCount} Paid Attendees
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Programme Schedule Editor */}
      <Card className="p-7 sm:p-9">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <ListChecks className="w-5 h-5 text-gold" />
            <h3 className="font-display text-lg font-bold text-bone">Event Schedule &amp; Agenda Editor</h3>
          </div>
          <button
            type="button"
            onClick={() =>
              setProgramme([
                ...programme,
                {
                  id: `prog-${Date.now()}`,
                  time: '10:00 – 10:30',
                  duration: '30 mins',
                  title: 'New Session',
                  detail: 'Session details',
                  kind: 'session',
                },
              ])
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-gold/40 text-gold text-xs font-semibold hover:bg-gold/10 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Agenda Row
          </button>
        </div>

        <div className="space-y-4">
          {programme.map((item, idx) => (
            <div key={item.id || idx} className="p-4 rounded border border-white/10 bg-black/30 flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-5 flex-1 w-full">
                <input
                  type="text"
                  value={item.time}
                  onChange={(e) => {
                    const copy = [...programme];
                    copy[idx].time = e.target.value;
                    setProgramme(copy);
                  }}
                  placeholder="09:00 – 09:30"
                  className="rounded-sm bg-black/60 border border-white/15 px-3 py-2 text-xs text-gold font-mono focus:border-gold focus:outline-none"
                />
                <input
                  type="text"
                  value={item.duration}
                  onChange={(e) => {
                    const copy = [...programme];
                    copy[idx].duration = e.target.value;
                    setProgramme(copy);
                  }}
                  placeholder="30 mins"
                  className="rounded-sm bg-black/60 border border-white/15 px-3 py-2 text-xs text-bone focus:border-gold focus:outline-none"
                />
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => {
                    const copy = [...programme];
                    copy[idx].title = e.target.value;
                    setProgramme(copy);
                  }}
                  placeholder="Session Title"
                  className="md:col-span-2 rounded-sm bg-black/60 border border-white/15 px-3 py-2 text-xs text-bone font-semibold focus:border-gold focus:outline-none"
                />
                <select
                  value={item.kind}
                  onChange={(e) => {
                    const copy = [...programme];
                    copy[idx].kind = e.target.value as 'session' | 'keynote' | 'spotlight';
                    setProgramme(copy);
                  }}
                  className="rounded-sm bg-black/60 border border-white/15 px-3 py-2 text-xs text-gold uppercase tracking-wider focus:border-gold focus:outline-none"
                >
                  <option value="session">Session</option>
                  <option value="keynote">Keynote</option>
                  <option value="spotlight">SME Spotlight</option>
                </select>
                <div className="sm:col-span-2 md:col-span-5">
                  <input
                    type="text"
                    value={item.detail}
                    onChange={(e) => {
                      const copy = [...programme];
                      copy[idx].detail = e.target.value;
                      setProgramme(copy);
                    }}
                    placeholder="Details or speaker topic…"
                    className="w-full rounded-sm bg-black/60 border border-white/15 px-3 py-2 text-xs text-muted focus:border-gold focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProgramme(programme.filter((_, i) => i !== idx))}
                className="p-2 text-red-400 hover:text-red-300 self-end md:self-center"
                title="Delete Row"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <Button type="button" onClick={saveProgramme} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Programme Schedule
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};

