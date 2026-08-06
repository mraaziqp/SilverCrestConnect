import React, { useState } from 'react';
import { PRISMA_SCHEMA_CODE } from '../data/prismaSchema';
import { Database, Code2, Play, Copy, Check, Terminal, ShieldCheck, Lock } from 'lucide-react';

export const SchemaInspector: React.FC<{ initialTab?: 'schema' | 'api' }> = ({ initialTab = 'schema' }) => {
  const [activeSubTab, setActiveSubTab] = useState<'schema' | 'api'>(initialTab);
  const [copied, setCopied] = useState<boolean>(false);
  const [testEndpoint, setTestEndpoint] = useState<string>('/api/stalls');
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [isLoadingApi, setIsLoadingApi] = useState<boolean>(false);

  const handleCopySchema = () => {
    navigator.clipboard.writeText(PRISMA_SCHEMA_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestApi = async (endpoint: string) => {
    setTestEndpoint(endpoint);
    setIsLoadingApi(true);
    try {
      let res;
      if (endpoint === '/api/stalls/reserve') {
        res = await fetch('/api/stalls/reserve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stallId: 'stall-a-102',
            userId: 'usr-demo-tester',
            companyName: 'Apex Business Systems',
          }),
        });
      } else if (endpoint === '/api/payments/checkout-session') {
        res = await fetch('/api/payments/checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stallId: 'stall-a-102',
            companyName: 'Apex Business Systems',
            email: 'exhibitor@apexbiz.com',
            taxId: 'EIN-99-2810291',
            selectedAddOnIds: ['addon-1'],
            isDepositOnly: true,
            paymentMethod: 'CREDIT_CARD',
          }),
        });
      } else if (endpoint === '/api/verified/lookup') {
        res = await fetch('/api/verified/lookup?taxId=EIN-98-3819203&company=Vance%20Tech');
      } else {
        res = await fetch('/api/stalls');
      }

      const json = await res.json();
      setApiResponse(JSON.stringify(json, null, 2));
    } catch (err) {
      setApiResponse(JSON.stringify({ error: 'Failed to connect to backend server' }, null, 2));
    } finally {
      setIsLoadingApi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="bg-[#121212] border border-[#262626] rounded-2xl p-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('schema')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'schema'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#B59226] text-black shadow-lg'
                : 'bg-black text-neutral-400 border border-neutral-800 hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Deliverable 1: Prisma/TypeScript Database Schema</span>
          </button>

          <button
            onClick={() => setActiveSubTab('api')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'api'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#B59226] text-black shadow-lg'
                : 'bg-black text-neutral-400 border border-neutral-800 hover:text-white'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Deliverable 2: Payment Flow & Live API Router</span>
          </button>
        </div>

        {activeSubTab === 'schema' && (
          <button
            onClick={handleCopySchema}
            className="px-3.5 py-1.5 rounded-lg bg-neutral-900 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-mono font-bold flex items-center gap-1.5 hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied to Clipboard' : 'Copy Schema.prisma'}</span>
          </button>
        )}
      </div>

      {activeSubTab === 'schema' && (
        <div className="bg-[#0A0A0A] border border-[#262626] rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
            <div>
              <h3 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-[#D4AF37]" />
                PostgreSQL + Prisma ORM Architecture
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Models for <strong className="text-white">User</strong>, <strong className="text-white">Stall</strong>, <strong className="text-white">Booking</strong>, and <strong className="text-white">VerifiedBadge</strong> with double-booking lock concurrency control.
              </p>
            </div>
            <span className="text-xs font-mono text-[#D4AF37] bg-[#1F1A0E] px-3 py-1 rounded-full border border-[#D4AF37]/30">
              schema.prisma
            </span>
          </div>

          <pre className="p-4 bg-black border border-neutral-800 rounded-xl font-mono text-xs text-neutral-300 overflow-x-auto max-h-[500px] leading-relaxed">
            <code>{PRISMA_SCHEMA_CODE}</code>
          </pre>
        </div>
      )}

      {activeSubTab === 'api' && (
        <div className="space-y-6">
          {/* API Flow Architecture Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-5 bg-[#121212] border border-[#262626] rounded-2xl space-y-2">
              <div className="font-bold text-white flex items-center gap-2 text-sm">
                <Lock className="w-4 h-4 text-[#D4AF37]" />
                <span>1. Atomicity & Reservation Locks</span>
              </div>
              <p className="text-neutral-400 leading-relaxed">
                <code className="text-[#D4AF37] bg-black px-1.5 py-0.5 rounded font-mono">POST /api/stalls/reserve</code> applies a 10-minute hold lock (`currentHoldExpiresAt`). If an exhibitor attempts to book a held stall, a 409 Conflict is returned.
              </p>
            </div>

            <div className="p-5 bg-[#121212] border border-[#262626] rounded-2xl space-y-2">
              <div className="font-bold text-white flex items-center gap-2 text-sm">
                <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                <span>2. "Verified" Platform API Integration</span>
              </div>
              <p className="text-neutral-400 leading-relaxed">
                <code className="text-[#D4AF37] bg-black px-1.5 py-0.5 rounded font-mono">GET /api/verified/lookup</code> queries the business verification platform using Tax ID/EIN to award Gold trust badges on vendor profiles.
              </p>
            </div>
          </div>

          {/* Live API Tester */}
          <div className="bg-[#0A0A0A] border border-[#262626] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="text-base font-serif font-bold text-white">
                  Live API Route Tester & JSON Response Inspector
                </h3>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2.5 py-0.5 rounded border border-emerald-800">
                Server Status: Active
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleTestApi('/api/stalls')}
                className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-mono text-xs rounded-lg border border-neutral-700 flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3 h-3 text-[#D4AF37]" />
                <span>GET /api/stalls</span>
              </button>

              <button
                onClick={() => handleTestApi('/api/stalls/reserve')}
                className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-mono text-xs rounded-lg border border-neutral-700 flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3 h-3 text-[#D4AF37]" />
                <span>POST /api/stalls/reserve</span>
              </button>

              <button
                onClick={() => handleTestApi('/api/payments/checkout-session')}
                className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-mono text-xs rounded-lg border border-neutral-700 flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3 h-3 text-[#D4AF37]" />
                <span>POST /api/payments/checkout-session</span>
              </button>

              <button
                onClick={() => handleTestApi('/api/verified/lookup')}
                className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-mono text-xs rounded-lg border border-neutral-700 flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3 h-3 text-[#D4AF37]" />
                <span>GET /api/verified/lookup</span>
              </button>
            </div>

            <div className="bg-black border border-neutral-800 rounded-xl p-4 font-mono text-xs text-neutral-300 min-h-[220px] max-h-[400px] overflow-auto">
              {isLoadingApi ? (
                <div className="text-neutral-500 animate-pulse">Executing HTTP Request to Express backend...</div>
              ) : apiResponse ? (
                <pre>{apiResponse}</pre>
              ) : (
                <div className="text-neutral-600">Click any endpoint button above to test live backend responses.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
