import React, { useState } from 'react';
import { Stall, StallTier, StallStatus } from '../types';
import { ShieldCheck, Filter, ZoomIn, ZoomOut, RotateCcw, Building2, Check, Info } from 'lucide-react';

interface FloorPlanProps {
  stalls: Stall[];
  selectedStall: Stall | null;
  onSelectStall: (stall: Stall) => void;
  activeHall: string;
  setActiveHall: (hall: 'Hall A - Main Innovation' | 'Hall B - Tech & SME' | 'VIP Central Atrium') => void;
}

export const FloorPlan: React.FC<FloorPlanProps> = ({
  stalls,
  selectedStall,
  onSelectStall,
  activeHall,
  setActiveHall,
}) => {
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Filter stalls based on hall, tier, and status
  const currentHallStalls = stalls.filter((s) => s.hall === activeHall);

  const filteredStalls = currentHallStalls.filter((s) => {
    if (selectedTierFilter !== 'ALL' && s.tier !== selectedTierFilter) return false;
    if (selectedStatusFilter !== 'ALL' && s.status !== selectedStatusFilter) return false;
    return true;
  });

  const getTierColorClass = (tier: StallTier, status: StallStatus, isSelected: boolean) => {
    if (isSelected) {
      return 'border-2 border-[#D4AF37] bg-[#D4AF37]/15 text-white shadow-[0_0_20px_rgba(212,175,55,0.35)] scale-[1.02] ring-1 ring-[#D4AF37]';
    }

    if (status === 'BOOKED') {
      return 'border border-white/10 bg-white/5 opacity-40 cursor-not-allowed select-none text-white/40';
    }

    if (status === 'ON_HOLD') {
      return 'border border-[#D4AF37]/70 bg-[#D4AF37]/10 text-[#D4AF37] animate-pulse cursor-pointer shadow-[0_0_12px_rgba(212,175,55,0.2)]';
    }

    // Available tiers styling with hover scale and metallic gold hover border
    return 'border border-white/20 bg-white/5 text-white/90 hover:border-[#D4AF37] hover:scale-105 hover:bg-[#D4AF37]/10 transition-all duration-300 cursor-pointer';
  };

  const getStatusIndicator = (status: StallStatus) => {
    switch (status) {
      case 'BOOKED':
        return <span className="inline-block w-2 h-2 rounded-full bg-neutral-500" />;
      case 'ON_HOLD':
        return <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />;
      case 'AVAILABLE':
      default:
        return <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />;
    }
  };

  return (
    <div className="bg-[#0A0A0A] border border-[#262626] rounded-2xl p-4 sm:p-6 shadow-2xl relative">
      {/* Top Controls: Hall Navigation Tabs & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-5 border-b border-[#262626]">
        {/* Hall Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveHall('VIP Central Atrium')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeHall === 'VIP Central Atrium'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#B59226] text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                : 'bg-[#121212] text-neutral-400 hover:text-white border border-[#262626]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>VIP Central Atrium</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded font-mono bg-black/30">
              {stalls.filter((s) => s.hall === 'VIP Central Atrium').length}
            </span>
          </button>

          <button
            onClick={() => setActiveHall('Hall A - Main Innovation')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeHall === 'Hall A - Main Innovation'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#B59226] text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                : 'bg-[#121212] text-neutral-400 hover:text-white border border-[#262626]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Hall A - Innovation</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded font-mono bg-black/30">
              {stalls.filter((s) => s.hall === 'Hall A - Main Innovation').length}
            </span>
          </button>

          <button
            onClick={() => setActiveHall('Hall B - Tech & SME')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeHall === 'Hall B - Tech & SME'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#B59226] text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                : 'bg-[#121212] text-neutral-400 hover:text-white border border-[#262626]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Hall B - Tech & SME</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded font-mono bg-black/30">
              {stalls.filter((s) => s.hall === 'Hall B - Tech & SME').length}
            </span>
          </button>
        </div>

        {/* Tier & Status Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-[#121212] border border-[#262626] rounded-xl px-3 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="text-neutral-400 font-medium">Tier:</span>
            <select
              value={selectedTierFilter}
              onChange={(e) => setSelectedTierFilter(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-black text-white">All Tiers</option>
              <option value="VIP_ISLAND" className="bg-black text-white">VIP Island</option>
              <option value="PLATINUM" className="bg-black text-white">Platinum</option>
              <option value="PREMIUM" className="bg-black text-white">Premium</option>
              <option value="STANDARD" className="bg-black text-white">Standard</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-[#121212] border border-[#262626] rounded-xl px-3 py-1.5 text-xs">
            <span className="text-neutral-400 font-medium">Status:</span>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-black text-white">All Statuses</option>
              <option value="AVAILABLE" className="bg-black text-white">Available Only</option>
              <option value="ON_HOLD" className="bg-black text-white">On Hold</option>
              <option value="BOOKED" className="bg-black text-white">Booked</option>
            </select>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center bg-[#121212] border border-[#262626] rounded-xl p-1 gap-1">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.1))}
              className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-neutral-400 px-1">{Math.round(zoomLevel * 100)}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
              className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Map Legend */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-4 text-xs font-medium text-neutral-400 bg-[#121212]/80 border border-[#262626] p-3 rounded-xl">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-emerald-500 bg-emerald-950/40" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-amber-500 bg-amber-950/60 animate-pulse" />
            <span>On Hold (10-Min Lock)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-neutral-700 bg-neutral-900" />
            <span>Booked / Reserved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-[#D4AF37] bg-[#2A200B]" />
            <span>Selected Booth</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[#D4AF37] font-mono text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>"Verified" Trust Badge Display Active</span>
        </div>
      </div>

      {/* Visual Floor Canvas Stage */}
      <div className="overflow-auto border border-[#262626] rounded-xl bg-[#0F0F0F] p-6 min-h-[440px] flex flex-col justify-center items-center relative shadow-inner">
        {/* Background Grid Pattern */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#D4AF37 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />

        {/* Entrance & Stage Markers */}
        <div className="w-full max-w-2xl mb-6 flex items-center justify-between text-[11px] font-mono text-neutral-500 uppercase tracking-widest">
          <div className="px-4 py-1 rounded bg-[#1A1A1A] border border-[#262626] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
            <span>MAIN ENTRANCE & REGISTRATION DESK</span>
          </div>
          <div className="px-4 py-1 rounded bg-[#1A1A1A] border border-[#262626]">
            <span>MAIN KEYNOTE STAGE &rarr;</span>
          </div>
        </div>

        {/* Interactive Floor Grid */}
        <div
          className="transition-transform duration-300 transform-gpu"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[#0A0A0A]/80 border border-[#262626] rounded-2xl shadow-2xl max-w-3xl">
            {filteredStalls.map((stall) => {
              const isSelected = selectedStall?.id === stall.id;
              return (
                <div
                  key={stall.id}
                  onClick={() => onSelectStall(stall)}
                  className={`relative p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[135px] group ${getTierColorClass(
                    stall.tier,
                    stall.status,
                    isSelected
                  )}`}
                >
                  {/* Top Bar inside Tile */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-extrabold text-sm tracking-tight">
                      {stall.code}
                    </span>
                    {getStatusIndicator(stall.status)}
                  </div>

                  {/* Middle Info */}
                  <div className="my-2">
                    {stall.status === 'BOOKED' ? (
                      <div>
                        <div className="text-xs font-bold text-white line-clamp-1">
                          {stall.bookedCompany}
                        </div>
                        {stall.verifiedBadgeId && (
                          <div className="flex items-center gap-1 text-[10px] text-[#D4AF37] font-semibold mt-0.5">
                            <ShieldCheck className="w-3 h-3 text-[#D4AF37]" />
                            <span>Verified Vendor</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="text-xs font-semibold text-neutral-300">
                          {stall.widthMeters}m &times; {stall.depthMeters}m
                        </div>
                        <div className="text-xs font-mono font-bold text-[#D4AF37] mt-0.5">
                          ${stall.basePriceUSD.toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Tier & Corner tag */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 pt-2 border-t border-white/10">
                    <span>{stall.tier.replace('_', ' ')}</span>
                    {stall.isCorner && <span className="text-[#D4AF37] font-bold">CORNER</span>}
                  </div>

                  {/* Selected Highlight Glow */}
                  {isSelected && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#D4AF37] text-black flex items-center justify-center font-bold shadow-[0_0_12px_rgba(212,175,55,0.8)]">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Floor Footer Info */}
        <div className="mt-8 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
          <Info className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>
            Showing {filteredStalls.length} stalls in <strong className="text-white">{activeHall}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
