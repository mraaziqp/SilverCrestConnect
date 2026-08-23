/**
 * PayFast & applications dashboard.
 *
 * Access is gated on an ADMIN_TOKEN held by the server; the token entered here
 * is kept in sessionStorage only, so closing the tab logs out. No PayFast
 * secret is ever sent to this page — the merchant key arrives masked.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Download,
  HandCoins,
  Loader2,
  LogOut,
  RefreshCw,
  Ticket,
  Users,
} from 'lucide-react';
import { Monogram, Button, Card } from '../components/Brand';
import { api, ApiRequestError, formatZAR, formatDateTime } from '../lib/api';
import type {
  Application,
  ApplicationStatus,
  DashboardStats,
  Payment,
  PayFastConfigStatus,
} from '../types';

const TOKEN_KEY = 'scc_admin_token';

interface Overview {
  stats: DashboardStats;
  payfast: PayFastConfigStatus;
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

type Tab = 'overview' | 'applications' | 'payments';

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
        api<{ stats: DashboardStats; payfast: PayFastConfigStatus; storage: Overview['storage'] }>('/api/admin/overview', { token }),
        api<{ applications: Application[] }>('/api/admin/applications', { token }),
        api<{ payments: Payment[] }>('/api/admin/payments', { token }),
      ]);
      setOverview({ stats: o.stats, payfast: o.payfast, storage: o.storage });
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

        <nav className="max-w-7xl mx-auto px-5 sm:px-8 flex gap-1 -mb-px" aria-label="Dashboard sections">
          {(
            [
              ['overview', 'Overview'],
              ['applications', `Applications (${applications.length})`],
              ['payments', `Payments (${payments.length})`],
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
          </>
        )}
      </main>
    </div>
  );
};

// --------------------------------------------------------------------- tabs

const OverviewTab: React.FC<{ overview: Overview }> = ({ overview }) => {
  const { stats, payfast, storage } = overview;

  return (
    <div className="space-y-8">
      {/* Warnings first — a misconfigured gateway is the thing that costs money. */}
      {(payfast.warnings.length > 0 || !storage.persistent) && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-amber-200">Configuration warnings</h3>
              <ul className="mt-3 space-y-2">
                {!storage.persistent && (
                  <li className="text-[13px] text-amber-100/80 leading-relaxed">• {storage.note}</li>
                )}
                {payfast.warnings.map((warning) => (
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
    </div>
  );
};

const ApplicationsTab: React.FC<{
  applications: Application[];
  onUpdate: (id: string, status: ApplicationStatus) => void;
}> = ({ applications, onUpdate }) => {
  const [filter, setFilter] = useState<ApplicationStatus | 'ALL'>('ALL');

  const visible = filter === 'ALL' ? applications : applications.filter((a) => a.status === filter);

  if (applications.length === 0) {
    return <Empty message="No applications yet." />;
  }

  return (
    <div>
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

      <div className="space-y-3">
        {visible.map((app) => (
          <Card key={app.id} className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-[15px] font-semibold text-bone">{app.businessName}</h3>
                  <StatusPill status={app.status} />
                  <span className="font-mono text-[11px] text-gold">{app.reference}</span>
                </div>
                <p className="mt-1.5 text-[13px] text-muted">
                  {app.contactName} · {app.industry}
                </p>
                <p className="mt-1 text-[12px] text-muted/70">
                  {app.email} · {app.phone}
                  {app.registrationNumber && ` · CIPC ${app.registrationNumber}`}
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
                <p className="mt-3 text-[13px] text-muted leading-relaxed max-w-2xl">{app.about}</p>
                {app.lookingFor && (
                  <p className="mt-2 text-[12px] text-muted/70 leading-relaxed max-w-2xl">
                    <span className="text-muted">Looking for:</span> {app.lookingFor}
                  </p>
                )}
                {app.ticketCode && (
                  <p className="mt-3 font-mono text-[12px] text-gold">Ticket: {app.ticketCode}</p>
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
