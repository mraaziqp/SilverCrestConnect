import React, { useState } from 'react';
import { Stall } from '../types';
import { ShieldCheck, Search, Building2, MapPin } from 'lucide-react';

interface ExhibitorDirectoryProps {
  stalls: Stall[];
  onOpenVerifiedModal: () => void;
}

export const ExhibitorDirectory: React.FC<ExhibitorDirectoryProps> = ({
  stalls,
  onOpenVerifiedModal,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');

  const bookedStalls = stalls.filter((s) => s.status === 'BOOKED');

  const filteredExhibitors = bookedStalls.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      (s.bookedCompany && s.bookedCompany.toLowerCase().includes(q)) ||
      s.code.toLowerCase().includes(q) ||
      s.hall.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="bg-[#121212] border border-[#262626] rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-xl font-serif font-bold text-white">Confirmed Exhibitor Directory</h2>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Discover verified SME owners, corporate sponsors, and keynote leaders exhibiting at Silver Crest Connect 2026.
          </p>
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search company or booth code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:border-[#D4AF37] focus:outline-none"
          />
        </div>
      </div>

      {/* Exhibitor Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredExhibitors.map((stall) => (
          <div
            key={stall.id}
            className="bg-[#121212] border border-[#262626] hover:border-[#D4AF37]/50 rounded-2xl p-5 shadow-xl transition-all duration-300 relative group overflow-hidden flex flex-col justify-between"
          >
            {/* Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#D4AF37] to-[#B59226] opacity-0 group-hover:opacity-100 transition-opacity" />

            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  {stall.bookedCompanyLogo ? (
                    <img
                      src={stall.bookedCompanyLogo}
                      alt={stall.bookedCompany}
                      className="w-12 h-12 rounded-xl object-cover border border-neutral-800 bg-neutral-900"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[#1F1A0E] border border-[#D4AF37]/30 text-[#D4AF37] flex items-center justify-center font-bold text-lg font-serif">
                      {stall.bookedCompany ? stall.bookedCompany.substring(0, 2).toUpperCase() : 'EX'}
                    </div>
                  )}

                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-[#D4AF37] transition-colors">
                      {stall.bookedCompany || 'Anonymous Exhibitor'}
                    </h3>
                    <p className="text-xs text-neutral-400 font-mono">
                      Booth <span className="text-[#D4AF37] font-bold">{stall.code}</span> ({stall.hall})
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-xs text-neutral-300">
                  <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>
                    {stall.widthMeters}m &times; {stall.depthMeters}m &bull; {stall.tier.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {stall.amenities.slice(0, 3).map((a, i) => (
                    <span
                      key={i}
                      className="text-[10px] text-neutral-400 bg-black/60 border border-neutral-800 px-2 py-0.5 rounded"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Trust Badge Status */}
            <div className="pt-3 border-t border-[#262626] flex items-center justify-between text-xs">
              <button
                onClick={onOpenVerifiedModal}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#D4AF37] bg-[#1F1A0E] border border-[#D4AF37]/30 hover:border-[#D4AF37] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>"Verified" Platform Certified</span>
              </button>

              <span className="text-[10px] font-mono text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-800 px-2 py-0.5 rounded">
                Confirmed
              </span>
            </div>
          </div>
        ))}
      </div>

      {filteredExhibitors.length === 0 && (
        <div className="bg-[#121212] border border-[#262626] rounded-2xl p-12 text-center text-neutral-400">
          <Building2 className="w-12 h-12 text-[#D4AF37] mx-auto mb-3 opacity-60" />
          <h3 className="text-lg font-serif font-bold text-white mb-1">No Exhibitors Found</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Try adjusting your search filter or reserve a stall on the floor plan to become the next confirmed exhibitor.
          </p>
        </div>
      )}
    </div>
  );
};
