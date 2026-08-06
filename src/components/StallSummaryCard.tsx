import React, { useState, useEffect } from 'react';
import { Stall, AddOnOption } from '../types';
import { MOCK_ADD_ONS } from '../data/mockData';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Zap,
  Wifi,
  Sparkles,
  ArrowRight,
  CreditCard,
  Building
} from 'lucide-react';

interface StallSummaryCardProps {
  selectedStall: Stall | null;
  onProceedToCheckout: (
    stall: Stall,
    selectedAddOns: AddOnOption[],
    isDepositOnly: boolean
  ) => void;
  onHoldStall: (stallId: string) => Promise<void>;
  isHolding: boolean;
  holdExpiresAt: string | null;
}

export const StallSummaryCard: React.FC<StallSummaryCardProps> = ({
  selectedStall,
  onProceedToCheckout,
  onHoldStall,
  isHolding,
  holdExpiresAt,
}) => {
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>(['addon-1']);
  const [isDepositOnly, setIsDepositOnly] = useState<boolean>(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(0);

  // Exhibitor Details Form State
  const [companyName, setCompanyName] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [taxId, setTaxId] = useState<string>('');

  // Verified Biz Link Status check simulation
  const [isScanningVerified, setIsScanningVerified] = useState<boolean>(false);
  const [verifiedStatus, setVerifiedStatus] = useState<{ verified: boolean; trustScore: number } | null>({
    verified: true,
    trustScore: 98,
  });

  const handleTriggerVerifiedScan = () => {
    setIsScanningVerified(true);
    setVerifiedStatus(null);
    setTimeout(() => {
      setIsScanningVerified(false);
      setVerifiedStatus({ verified: true, trustScore: 98 });
    }, 1200);
  };

  // Timer logic for 10-minute lock
  useEffect(() => {
    if (!holdExpiresAt) {
      setTimeLeftSeconds(600); // Default 10:00 timer display for reservation lock
      return;
    }

    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000));
      setTimeLeftSeconds(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [holdExpiresAt]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleAddOn = (id: string) => {
    setSelectedAddOnIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  if (!selectedStall) {
    return (
      <div className="bg-[#121212] border border-[#262626] rounded-2xl p-6 text-center text-neutral-400 flex flex-col items-center justify-center min-h-[420px] shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-[#1F1A0E] border border-[#D4AF37]/30 flex items-center justify-center mb-4 text-[#D4AF37]">
          <Building className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-serif font-bold text-white mb-2">No Stall Selected</h3>
        <p className="text-xs text-neutral-400 max-w-xs leading-relaxed mb-4">
          Click any stall on the interactive floor plan to view booth dimensions, included amenities, tier pricing, and hold status.
        </p>
        <div className="inline-flex items-center gap-2 text-xs font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-3 py-1.5 rounded-full border border-[#D4AF37]/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Interactive Floor Layout Active</span>
        </div>
      </div>
    );
  }

  // Calculate pricing math
  const selectedAddOnsList = MOCK_ADD_ONS.filter((a) => selectedAddOnIds.includes(a.id));
  const addOnsTotal = selectedAddOnsList.reduce((sum, a) => sum + a.priceUSD, 0);
  const subtotal = selectedStall.basePriceUSD + addOnsTotal;
  const taxVat18 = Math.round(subtotal * 0.18 * 100) / 100;
  const grandTotal = subtotal + taxVat18;
  const amountToPayNow = isDepositOnly ? Math.round(grandTotal * 0.3 * 100) / 100 : grandTotal;

  return (
    <div className="bg-[#121212] border border-[#D4AF37]/30 rounded-2xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.8)] relative overflow-hidden flex flex-col justify-between">
      {/* Top Gold Accent Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#B59226]" />

      <div>
        {/* Stall Code & Tier Banner */}
        <div className="flex items-center justify-between gap-2 mb-4 pb-4 border-b border-[#262626]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl font-extrabold text-white font-mono tracking-tight">
                Booth {selectedStall.code}
              </span>
              {selectedStall.isCorner && (
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/30 px-2 py-0.5 rounded">
                  Corner Stall
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 flex items-center gap-1.5 font-medium">
              <span>{selectedStall.hall}</span>
              <span>&bull;</span>
              <span>{selectedStall.widthMeters}m &times; {selectedStall.depthMeters}m ({selectedStall.widthMeters * selectedStall.depthMeters} sq.m)</span>
            </p>
          </div>

          <div className="text-right">
            <span
              className={`inline-block text-xs font-extrabold tracking-wider px-2.5 py-1 rounded-md uppercase border ${
                selectedStall.tier === 'VIP_ISLAND'
                  ? 'bg-[#2A200B] text-[#D4AF37] border-[#D4AF37]/60 shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                  : selectedStall.tier === 'PLATINUM'
                  ? 'bg-neutral-800 text-slate-200 border-slate-600'
                  : selectedStall.tier === 'PREMIUM'
                  ? 'bg-[#1C180C] text-amber-300 border-amber-500/40'
                  : 'bg-neutral-900 text-neutral-300 border-neutral-700'
              }`}
            >
              {selectedStall.tier.replace('_', ' ')}
            </span>
            <div className="text-xs font-mono text-neutral-400 mt-1">
              Base: <span className="text-white font-bold">${selectedStall.basePriceUSD.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Status & 10-Minute Hold Lock Section */}
        {selectedStall.status === 'BOOKED' ? (
          <div className="mb-5 p-3.5 rounded-xl bg-neutral-900/90 border border-neutral-800 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#D4AF37] flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-white">Reserved by {selectedStall.bookedCompany}</div>
              <div className="text-[11px] text-neutral-400">This booth is confirmed for Silver Crest Connect 2026.</div>
            </div>
          </div>
        ) : (
          <div className="mb-5 p-3.5 rounded-xl bg-[#1A160A] border border-[#D4AF37]/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-[#D4AF37] animate-spin-slow flex-shrink-0" />
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>10-Min Reservation Hold Lock</span>
                  <span className="inline-block w-2 h-2 rounded-full bg-[#D4AF37] animate-ping" />
                </div>
                <p className="text-[11px] text-neutral-400">
                  {holdExpiresAt
                    ? `Locked for your checkout session`
                    : `Click Reserve to lock this stall for 10 minutes`}
                </p>
              </div>
            </div>

            {holdExpiresAt ? (
              <div className="text-right">
                <span className="font-mono text-base font-extrabold text-[#D4AF37]">
                  {formatTimer(timeLeftSeconds)}
                </span>
                <div className="text-[10px] text-neutral-400 uppercase font-mono">Time Left</div>
              </div>
            ) : (
              <button
                onClick={() => onHoldStall(selectedStall.id)}
                disabled={isHolding}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#D4AF37]/20 text-[#D4AF37] hover:bg-[#D4AF37]/30 border border-[#D4AF37]/40 transition-all whitespace-nowrap"
              >
                {isHolding ? 'Holding...' : 'Hold Booth'}
              </button>
            )}
          </div>
        )}

        {/* Exhibitor Details Form & Verified Integration Check */}
        {selectedStall.status !== 'BOOKED' && (
          <div className="mb-5 p-3.5 bg-black/60 border border-white/10 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-white/80 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-[#D4AF37]" />
                Exhibitor Details
              </label>
              <span className="text-[9px] uppercase tracking-wider text-[#D4AF37] font-semibold">Required for Pass</span>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Company Legal Name *"
                  className="w-full bg-[#121212] border border-white/15 rounded-lg px-3 py-2 text-white placeholder:text-white/30 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="Business Email *"
                  className="w-full bg-[#121212] border border-white/15 rounded-lg px-3 py-2 text-white placeholder:text-white/30 focus:border-[#D4AF37] focus:outline-none"
                />
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Phone Number"
                  className="w-full bg-[#121212] border border-white/15 rounded-lg px-3 py-2 text-white placeholder:text-white/30 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              <div>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="Tax ID / EIN *"
                  className="w-full bg-[#121212] border border-white/15 rounded-lg px-3 py-2 text-white placeholder:text-white/30 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
            </div>

            {/* Verified Integration Check simulation element */}
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                  <span className="text-[11px] font-semibold text-white/90">VerifiedBizLink Status:</span>
                </div>
                <button
                  type="button"
                  onClick={handleTriggerVerifiedScan}
                  disabled={isScanningVerified}
                  className="text-[10px] uppercase font-bold text-[#D4AF37] hover:underline"
                >
                  {isScanningVerified ? 'Scanning...' : 'Re-Scan'}
                </button>
              </div>

              {isScanningVerified ? (
                <div className="mt-2 p-2 bg-[#1A160A] border border-[#D4AF37]/30 rounded-lg flex items-center gap-2 text-xs text-[#D4AF37]">
                  <Sparkles className="w-4 h-4 animate-spin text-[#D4AF37]" />
                  <span className="font-mono text-[11px]">Scanning for Verified Business Profile...</span>
                </div>
              ) : verifiedStatus ? (
                <div className="mt-2 p-2 bg-[#D4AF37]/10 border border-[#D4AF37]/40 rounded-lg flex items-center justify-between text-xs text-white">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                    <span className="font-semibold text-[11px]">Verified Business Badge Active</span>
                  </div>
                  <span className="font-mono text-[10px] font-bold text-[#D4AF37] bg-black/40 px-2 py-0.5 rounded">
                    Score: {verifiedStatus.trustScore}/100
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Technical Amenities */}
        <div className="mb-5">
          <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-2 font-mono">
            Included Technical Features
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-black/60 rounded-lg border border-neutral-800 flex items-center gap-2 text-neutral-300">
              <Zap className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{selectedStall.powerSupplyKw} kW Power Feed</span>
            </div>
            <div className="p-2 bg-black/60 rounded-lg border border-neutral-800 flex items-center gap-2 text-neutral-300">
              <Wifi className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{selectedStall.wifiSpeedMbps} Mbps Dedicated Wi-Fi</span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selectedStall.amenities.map((amenity, idx) => (
              <span
                key={idx}
                className="text-[10px] text-neutral-300 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-md"
              >
                &bull; {amenity}
              </span>
            ))}
          </div>
        </div>

        {/* Add-On Options Selection */}
        {selectedStall.status !== 'BOOKED' && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider font-mono">
                Recommended Add-On Packages
              </label>
              <span className="text-[10px] text-[#D4AF37] font-medium">Optional Upgrades</span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
              {MOCK_ADD_ONS.map((addon) => {
                const isSelected = selectedAddOnIds.includes(addon.id);
                return (
                  <div
                    key={addon.id}
                    onClick={() => toggleAddOn(addon.id)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-[#1D170B] border-[#D4AF37]/60 text-white shadow-[0_0_10px_rgba(212,175,55,0.1)]'
                        : 'bg-black/40 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected ? 'bg-[#D4AF37] border-[#D4AF37] text-black' : 'border-neutral-700'
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{addon.name}</div>
                        <div className="text-[10px] text-neutral-400 line-clamp-1">{addon.description}</div>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-[#D4AF37] whitespace-nowrap">
                      +${addon.priceUSD}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Payment Term Selector (Full vs 30% Deposit) */}
        {selectedStall.status !== 'BOOKED' && (
          <div className="mb-5 p-3 bg-neutral-900/80 border border-neutral-800 rounded-xl">
            <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider font-mono mb-2">
              Payment Term Structure
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsDepositOnly(false)}
                className={`p-2 rounded-lg text-xs font-semibold border text-center transition-all ${
                  !isDepositOnly
                    ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                    : 'bg-black text-neutral-400 border-neutral-800 hover:text-white'
                }`}
              >
                Full Payment (100%)
                <div className="text-[10px] opacity-80 font-normal">Immediate Confirmation</div>
              </button>

              <button
                type="button"
                onClick={() => setIsDepositOnly(true)}
                className={`p-2 rounded-lg text-xs font-semibold border text-center transition-all ${
                  isDepositOnly
                    ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                    : 'bg-black text-neutral-400 border-neutral-800 hover:text-white'
                }`}
              >
                30% Reserve Deposit
                <div className="text-[10px] opacity-80 font-normal">Balance 30 days before event</div>
              </button>
            </div>
          </div>
        )}

        {/* Pricing Calculation Summary */}
        <div className="bg-black/90 rounded-xl p-4 border border-neutral-800 mb-6 space-y-2 text-xs font-mono">
          <div className="flex justify-between text-neutral-400">
            <span>Booth Base ({selectedStall.code})</span>
            <span className="text-white">${selectedStall.basePriceUSD.toLocaleString()}</span>
          </div>

          {selectedAddOnsList.length > 0 && (
            <div className="flex justify-between text-neutral-400">
              <span>Add-Ons ({selectedAddOnsList.length})</span>
              <span className="text-white">+${addOnsTotal.toLocaleString()}</span>
            </div>
          )}

          <div className="flex justify-between text-neutral-400">
            <span>Subtotal</span>
            <span className="text-white">${subtotal.toLocaleString()}</span>
          </div>

          <div className="flex justify-between text-neutral-400">
            <span>VAT / State Tax (18%)</span>
            <span className="text-white">${taxVat18.toLocaleString()}</span>
          </div>

          <div className="h-px bg-neutral-800 my-2" />

          <div className="flex justify-between text-sm font-bold text-white pt-1">
            <span>Total Package Price</span>
            <span>${grandTotal.toLocaleString()} USD</span>
          </div>

          <div className="flex justify-between items-center text-sm font-extrabold text-[#D4AF37] pt-1 bg-[#1A160A] -mx-4 -mb-4 p-3 rounded-b-xl border-t border-[#D4AF37]/30">
            <span>{isDepositOnly ? 'Due Today (30% Deposit):' : 'Amount Due Now:'}</span>
            <span className="text-lg font-mono">${amountToPayNow.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Prominent Gold CTA Button */}
      <div>
        {selectedStall.status === 'BOOKED' ? (
          <button
            disabled
            className="w-full py-3.5 rounded-xl font-bold text-sm bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700 text-center"
          >
            Stall Already Booked
          </button>
        ) : (
          <button
            onClick={() => onProceedToCheckout(selectedStall, selectedAddOnsList, isDepositOnly)}
            className="w-full py-4 rounded-xl font-bold text-sm bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#B59226] text-black shadow-[0_0_25px_rgba(212,175,55,0.35)] hover:shadow-[0_0_35px_rgba(212,175,55,0.5)] transition-all duration-300 flex items-center justify-center gap-2 group cursor-pointer border border-[#F3E5AB] uppercase tracking-[0.15em]"
          >
            <span>CONFIRM RESERVATION & PAY</span>
            <ArrowRight className="w-4 h-4 text-black group-hover:translate-x-1 transition-transform" />
          </button>
        )}

        <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-neutral-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
            "Verified" API Secured
          </span>
          <span>&bull;</span>
          <span className="flex items-center gap-1">
            <CreditCard className="w-3.5 h-3.5 text-neutral-400" />
            Instant Confirmation
          </span>
        </div>
      </div>
    </div>
  );
};
