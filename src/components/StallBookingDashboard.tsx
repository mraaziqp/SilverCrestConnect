import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { FloorPlan } from './FloorPlan';
import { StallSummaryCard } from './StallSummaryCard';
import { CheckoutModal } from './CheckoutModal';
import { ExhibitorDirectory } from './ExhibitorDirectory';
import { AttendeeNetworkingHub } from './AttendeeNetworkingHub';
import { AgendaDashboard } from './AgendaDashboard';
import { MyBookings } from './MyBookings';
import { SchemaInspector } from './SchemaInspector';
import { VerifiedBadgeModal } from './VerifiedBadgeModal';
import { Stall, AddOnOption, Booking } from '../types';
import { MOCK_STALLS, INITIAL_BOOKINGS } from '../data/mockData';
import { Sparkles, Calendar, MapPin } from 'lucide-react';

export const StallBookingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'floorplan' | 'directory' | 'networking' | 'agenda' | 'mybookings' | 'schema' | 'api'>('floorplan');
  const [activeHall, setActiveHall] = useState<'Hall A - Main Innovation' | 'Hall B - Tech & SME' | 'VIP Central Atrium'>('Hall A - Main Innovation');
  
  const [stalls, setStalls] = useState<Stall[]>(MOCK_STALLS);
  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS);
  const [selectedStall, setSelectedStall] = useState<Stall | null>(MOCK_STALLS[3]); // A-102 selected initially
  
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [checkoutAddOns, setCheckoutAddOns] = useState<AddOnOption[]>([]);
  const [checkoutIsDeposit, setCheckoutIsDeposit] = useState<boolean>(false);
  
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  const [isVerifiedModalOpen, setIsVerifiedModalOpen] = useState<boolean>(false);

  // Fetch stalls from Express server on mount
  useEffect(() => {
    fetchStalls();
  }, []);

  const fetchStalls = async () => {
    try {
      const res = await fetch('/api/stalls');
      const data = await res.json();
      if (data.success && data.stalls) {
        setStalls(data.stalls);
      }
    } catch (err) {
      console.warn('Backend API connection fallback to initial stalls');
    }
  };

  const handleHoldStall = async (stallId: string) => {
    setIsHolding(true);
    try {
      const res = await fetch('/api/stalls/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stallId,
          userId: 'user-demo-1',
          companyName: 'Reserved Exhibitor',
        }),
      });

      const data = await res.json();
      if (data.success && data.stall) {
        setHoldExpiresAt(data.expiresAt);
        setStalls((prev) => prev.map((s) => (s.id === stallId ? data.stall : s)));
        setSelectedStall(data.stall);
      } else {
        alert(data.error || 'Failed to hold stall');
      }
    } catch (err) {
      // Fallback
      const holdTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      setHoldExpiresAt(holdTime);
      setStalls((prev) =>
        prev.map((s) =>
          s.id === stallId ? { ...s, status: 'ON_HOLD', currentHoldExpiresAt: holdTime } : s
        )
      );
    } finally {
      setIsHolding(false);
    }
  };

  const handleOpenCheckout = (
    stall: Stall,
    selectedAddOns: AddOnOption[],
    isDepositOnly: boolean
  ) => {
    setSelectedStall(stall);
    setCheckoutAddOns(selectedAddOns);
    setCheckoutIsDeposit(isDepositOnly);
    setIsCheckoutOpen(true);
  };

  const handleBookingSuccess = (newBooking: Booking) => {
    setBookings((prev) => [newBooking, ...prev]);
    fetchStalls();
  };

  const confirmedCount = stalls.filter((s) => s.status === 'BOOKED').length;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white selection:bg-[#D4AF37] selection:text-black font-sans flex flex-col antialiased">
      
      {/* Header with Event Tagline "Building Business. Strengthening Community." */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenVerifiedModal={() => setIsVerifiedModalOpen(true)}
        confirmedCount={confirmedCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Main Tab View: Floor Plan & Booking */}
        {activeTab === 'floorplan' && (
          <div className="space-y-6">
            
            {/* Event Hero Info Strip */}
            <div className="bg-gradient-to-r from-[#121212] via-[#1A160A] to-[#121212] border border-[#D4AF37]/30 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-mono font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>ANNUAL EXHIBITION & NETWORKING SUMMIT</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
                  Silver Crest Connect <span className="text-[#D4AF37]">Floor Plan Engine</span>
                </h2>
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-light">
                  Select an available booth on the interactive floor map to view booth specifications, hold a 10-minute reservation lock, and lock in your position for the premier business summit.
                </p>
              </div>

              <div className="flex items-center gap-4 bg-black/60 p-4 rounded-xl border border-neutral-800 font-mono text-xs text-neutral-300 flex-shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-white font-bold">
                    <Calendar className="w-4 h-4 text-[#D4AF37]" />
                    <span>OCTOBER 14 - 16, 2026</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-neutral-400">
                    <MapPin className="w-4 h-4 text-[#D4AF37]" />
                    <span>Grand Crest Convention Center</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dashboard Split View: Floor Plan (Left) + Summary Card (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* Interactive Floor Layout (2 Columns) */}
              <div className="lg:col-span-2">
                <FloorPlan
                  stalls={stalls}
                  selectedStall={selectedStall}
                  onSelectStall={(s) => {
                    setSelectedStall(s);
                    setHoldExpiresAt(s.currentHoldExpiresAt || null);
                  }}
                  activeHall={activeHall}
                  setActiveHall={setActiveHall}
                />
              </div>

              {/* Selected Stall Summary Card (1 Column) */}
              <div className="lg:col-span-1 sticky top-24">
                <StallSummaryCard
                  selectedStall={selectedStall}
                  onProceedToCheckout={handleOpenCheckout}
                  onHoldStall={handleHoldStall}
                  isHolding={isHolding}
                  holdExpiresAt={holdExpiresAt}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab View: Exhibitor Directory */}
        {activeTab === 'directory' && (
          <ExhibitorDirectory
            stalls={stalls}
            onOpenVerifiedModal={() => setIsVerifiedModalOpen(true)}
          />
        )}

        {/* Tab View: Networking & B2B Matchmaking Hub */}
        {activeTab === 'networking' && (
          <AttendeeNetworkingHub />
        )}

        {/* Tab View: Event Agenda & Keynotes */}
        {activeTab === 'agenda' && (
          <AgendaDashboard
            onNavigateToNetworking={() => setActiveTab('networking')}
          />
        )}

        {/* Tab View: My Passes */}
        {activeTab === 'mybookings' && (
          <MyBookings
            bookings={bookings}
            onOpenFloorplan={() => setActiveTab('floorplan')}
          />
        )}

        {/* Tab View: Database Schema & API Route Inspector */}
        {(activeTab === 'schema' || activeTab === 'api') && (
          <SchemaInspector initialTab={activeTab} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#262626] bg-[#0A0A0A] py-8 text-neutral-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-white text-sm">Silver Crest Connect</span>
            <span>&bull;</span>
            <span className="text-neutral-300">Presented by Silver Crest Consulting</span>
          </div>

          <div className="text-center md:text-right text-neutral-400 font-mono text-[11px]">
            <span>"Building Business. Strengthening Community."</span>
            <span className="mx-2">&bull;</span>
            <span className="text-[#D4AF37]">API-First "Verified" Platform</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        stall={selectedStall}
        selectedAddOns={checkoutAddOns}
        isDepositOnly={checkoutIsDeposit}
        onBookingSuccess={handleBookingSuccess}
      />

      <VerifiedBadgeModal
        isOpen={isVerifiedModalOpen}
        onClose={() => setIsVerifiedModalOpen(false)}
      />
    </div>
  );
};
