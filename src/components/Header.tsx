import React from 'react';
import { ShieldCheck, Layers, Building2, Ticket, Users, Calendar, Database, Code2, Sparkles } from 'lucide-react';

interface HeaderProps {
  activeTab: 'floorplan' | 'directory' | 'networking' | 'agenda' | 'mybookings' | 'schema' | 'api';
  setActiveTab: (tab: 'floorplan' | 'directory' | 'networking' | 'agenda' | 'mybookings' | 'schema' | 'api') => void;
  onOpenVerifiedModal: () => void;
  confirmedCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenVerifiedModal,
  confirmedCount,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/10">
      {/* Top Exclusive Tier Banner */}
      <div className="bg-[#121212] border-b border-white/10 py-2 px-4 text-xs font-medium text-center text-white/80 flex items-center justify-center gap-2 flex-wrap">
        <Sparkles className="w-3.5 h-3.5 text-[#D4AF37] animate-pulse" />
        <span className="uppercase tracking-[0.2em] text-[11px]">SILVER CREST CONNECT &bull; EXECUTIVE BUSINESS SUMMIT & EXHIBITION</span>
        <span className="hidden md:inline-block text-white/30">|</span>
        <span className="hidden md:inline-block text-[#D4AF37] text-[11px] uppercase tracking-wider">Presented by Silver Crest Consulting</span>
        <button
          onClick={onOpenVerifiedModal}
          className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/30 hover:bg-[#D4AF37]/20 transition-all rounded-sm"
        >
          <ShieldCheck className="w-3 h-3 text-[#D4AF37]" />
          <span>Verified™ Integration Active</span>
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Brand & Event Title */}
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 border-2 border-[#D4AF37] rotate-45 flex items-center justify-center shrink-0 my-1">
              <span className="text-[#D4AF37] font-bold text-xs -rotate-45">SC</span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-light tracking-[0.2em] uppercase text-white">
                  Silver Crest <span className="font-bold text-[#D4AF37]">Connect</span>
                </h1>
                <span className="text-[9px] uppercase tracking-[0.2em] bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 px-2 py-0.5 rounded-sm font-semibold">
                  Exhibitor Portal
                </span>
              </div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mt-0.5">
                "Building Business. Strengthening Community."
              </p>
            </div>
          </div>

          {/* Navigation Bar */}
          <nav className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              onClick={() => setActiveTab('floorplan')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.15em] transition-all whitespace-nowrap rounded-sm ${
                activeTab === 'floorplan'
                  ? 'bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.25)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Floor Plan</span>
            </button>

            <button
              onClick={() => setActiveTab('directory')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.15em] transition-all whitespace-nowrap rounded-sm ${
                activeTab === 'directory'
                  ? 'bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.25)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Directory</span>
              {confirmedCount > 0 && (
                <span className={`px-1.5 py-0.2 text-[10px] font-mono rounded-xs ${
                  activeTab === 'directory' ? 'bg-black text-[#D4AF37]' : 'bg-[#D4AF37]/20 text-[#D4AF37]'
                }`}>
                  {confirmedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('networking')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.15em] transition-all whitespace-nowrap rounded-sm ${
                activeTab === 'networking'
                  ? 'bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.25)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Attendee Hub</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
            </button>

            <button
              onClick={() => setActiveTab('agenda')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.15em] transition-all whitespace-nowrap rounded-sm ${
                activeTab === 'agenda'
                  ? 'bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.25)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Agenda & Keynotes</span>
            </button>

            <button
              onClick={() => setActiveTab('mybookings')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.15em] transition-all whitespace-nowrap rounded-sm ${
                activeTab === 'mybookings'
                  ? 'bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.25)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Ticket className="w-4 h-4" />
              <span>My Passes</span>
            </button>

            <div className="h-5 w-px bg-white/10 mx-1 hidden sm:block" />

            <button
              onClick={() => setActiveTab('schema')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium tracking-wider uppercase transition-all whitespace-nowrap rounded-sm border ${
                activeTab === 'schema'
                  ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]'
                  : 'text-white/50 border-white/10 hover:text-white hover:border-white/30'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Schema</span>
            </button>

            <button
              onClick={() => setActiveTab('api')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium tracking-wider uppercase transition-all whitespace-nowrap rounded-sm border ${
                activeTab === 'api'
                  ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]'
                  : 'text-white/50 border-white/10 hover:text-white hover:border-white/30'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>API Routes</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
