import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Stall, AddOnOption, Booking, CheckoutSessionResponse } from '../types';
import {
  ShieldCheck,
  X,
  CreditCard,
  Building,
  CheckCircle2,
  Lock,
  ArrowRight,
  QrCode,
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  stall: Stall | null;
  selectedAddOns: AddOnOption[];
  isDepositOnly: boolean;
  onBookingSuccess: (booking: Booking) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  stall,
  selectedAddOns,
  isDepositOnly,
  onBookingSuccess,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [companyName, setCompanyName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('+1 (555) 392-1029');
  const [taxId, setTaxId] = useState<string>('EIN-88-9201928');
  const [website, setWebsite] = useState<string>('https://mycompany.com');
  const [paymentMethod, setPaymentMethod] = useState<'CREDIT_CARD' | 'BANK_WIRE' | 'APPLE_PAY' | 'CORPORATE_INVOICE'>('CREDIT_CARD');
  
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedBooking, setCompletedBooking] = useState<Booking | null>(null);
  const [sessionData, setSessionData] = useState<CheckoutSessionResponse | null>(null);

  if (!isOpen || !stall) return null;

  // Totals calculation
  const addOnsTotal = selectedAddOns.reduce((sum, a) => sum + a.priceZAR, 0);
  const subtotal = stall.basePriceZAR + addOnsTotal;
  const taxVat15 = Math.round(subtotal * 0.15 * 100) / 100;
  const grandTotal = subtotal + taxVat15;
  const amountToPayNow = isDepositOnly ? Math.round(grandTotal * 0.3 * 100) / 100 : grandTotal;

  // Step 1 -> Step 2: Validate Company and initiate session
  const handleInitiateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !email) {
      setErrorMsg('Company Name and Business Email are required.');
      return;
    }

    setErrorMsg(null);
    setIsProcessing(true);

    try {
      const response = await fetch('/api/payments/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stallId: stall.id,
          companyName,
          email,
          phone,
          website,
          taxId,
          selectedAddOnIds: selectedAddOns.map((a) => a.id),
          isDepositOnly,
          paymentMethod,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSessionData(data.session);
        setStep(2);
      } else {
        setErrorMsg(data.error || 'Failed to initialize payment session.');
      }
    } catch (err) {
      setErrorMsg('Network error connecting to backend API.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 2 -> Step 3 & 4: Process simulated payment
  const handleConfirmPayment = async () => {
    if (!sessionData) return;
    setIsProcessing(true);
    setStep(3);

    try {
      // Simulate gateway delay
      await new Promise((r) => setTimeout(r, 2200));

      const response = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: sessionData.bookingId,
          transactionId: 'TXN-SCC-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCompletedBooking(data.booking);
        setStep(4);
        onBookingSuccess(data.booking);

        // Confetti burst
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#D4AF37', '#F3E5AB', '#FFFFFF', '#B59226'],
        });
      } else {
        setErrorMsg(data.error || 'Payment confirmation failed.');
        setStep(2);
      }
    } catch (err) {
      setErrorMsg('Payment gateway timeout.');
      setStep(2);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#121212] border border-[#D4AF37]/40 rounded-2xl w-full max-w-2xl overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.2)] flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-[#262626] bg-[#0A0A0A] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1F1A0E] border border-[#D4AF37]/40 text-[#D4AF37] flex items-center justify-center font-serif font-bold">
              SC
            </div>
            <div>
              <h3 className="text-base font-serif font-bold text-white">
                Silver Crest Connect &bull; Stall Checkout
              </h3>
              <p className="text-xs text-neutral-400">
                Reserving Booth <strong className="text-[#D4AF37]">{stall.code}</strong> ({stall.hall})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Stepper */}
        <div className="bg-[#0F0F0F] px-6 py-3 border-b border-[#262626] flex items-center justify-between text-xs font-mono">
          <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-[#D4AF37] font-bold' : 'text-neutral-500'}`}>
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">1</span>
            <span>Corporate Info</span>
          </div>
          <span className="text-neutral-700">&rarr;</span>
          <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-[#D4AF37] font-bold' : 'text-neutral-500'}`}>
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">2</span>
            <span>Payment Method</span>
          </div>
          <span className="text-neutral-700">&rarr;</span>
          <div className={`flex items-center gap-1.5 ${step === 4 ? 'text-[#D4AF37] font-bold' : 'text-neutral-500'}`}>
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">3</span>
            <span>Pass & Invoice</span>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Corporate Details & "Verified" API Check */}
          {step === 1 && (
            <form onSubmit={handleInitiateSession} className="space-y-4">
              <div className="p-3 bg-[#1A160A] border border-[#D4AF37]/30 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
                  <div>
                    <div className="text-xs font-bold text-white">"Verified" Trust Platform Integration</div>
                    <div className="text-[11px] text-neutral-400">
                      Providing a valid Tax ID/EIN awards a Gold Trust Badge on the floor map.
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">Company Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Apex Global Innovations LLC"
                    className="w-full bg-black border border-neutral-800 rounded-lg p-2.5 text-white focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">Business Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exhibitor@company.com"
                    className="w-full bg-black border border-neutral-800 rounded-lg p-2.5 text-white focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">Tax Registration / EIN *</label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="EIN-88-9201928"
                    className="w-full bg-black border border-neutral-800 rounded-lg p-2.5 text-white focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">Company Website</label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://company.com"
                    className="w-full bg-black border border-neutral-800 rounded-lg p-2.5 text-white focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>

              {/* Order Summary box */}
              <div className="p-3.5 bg-black rounded-xl border border-neutral-800 text-xs font-mono space-y-1.5">
                <div className="flex justify-between text-neutral-400">
                  <span>Booth {stall.code} ({stall.tier})</span>
                  <span className="text-white">R{stall.basePriceZAR.toLocaleString()}</span>
                </div>
                {selectedAddOns.length > 0 && (
                  <div className="flex justify-between text-neutral-400">
                    <span>Add-Ons ({selectedAddOns.length})</span>
                    <span className="text-white">+R{addOnsTotal.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-[#D4AF37] pt-1 border-t border-neutral-800">
                  <span>{isDepositOnly ? 'Deposit Due Today (30%):' : 'Amount Due Today:'}</span>
                  <span>R{amountToPayNow.toLocaleString()} ZAR</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3.5 bg-gradient-to-r from-[#D4AF37] to-[#B59226] text-black font-bold text-sm rounded-xl shadow-lg hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isProcessing ? (
                  <span>Connecting to Verified API...</span>
                ) : (
                  <>
                    <span>CONTINUE TO PAYMENT METHOD</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: Choose Payment Gateway Method */}
          {step === 2 && sessionData && (
            <div className="space-y-4">
              <div className="text-xs text-neutral-300 font-semibold mb-1">
                Select Corporate Payment Instrument:
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CREDIT_CARD')}
                  className={`p-3.5 rounded-xl border flex flex-col items-start gap-2 transition-all ${
                    paymentMethod === 'CREDIT_CARD'
                      ? 'bg-[#1D170B] border-[#D4AF37] text-white shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                      : 'bg-black border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-[#D4AF37]" />
                  <div className="font-bold text-left">Corporate Credit Card</div>
                  <div className="text-[10px] text-neutral-400">Instant Processing (Visa, Amex)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('BANK_WIRE')}
                  className={`p-3.5 rounded-xl border flex flex-col items-start gap-2 transition-all ${
                    paymentMethod === 'BANK_WIRE'
                      ? 'bg-[#1D170B] border-[#D4AF37] text-white shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                      : 'bg-black border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  <Building className="w-5 h-5 text-[#D4AF37]" />
                  <div className="font-bold text-left">Bank Wire / SWIFT</div>
                  <div className="text-[10px] text-neutral-400">Direct Silver Crest Escrow Account</div>
                </button>
              </div>

              {/* Payment Details Form Mock */}
              <div className="p-4 bg-black border border-neutral-800 rounded-xl text-xs space-y-3">
                <div className="font-bold text-white flex items-center justify-between">
                  <span>Payment Gateway Authorization</span>
                  <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
                </div>

                <div>
                  <label className="block text-neutral-400 text-[11px] mb-1">Card Number / Corporate Account</label>
                  <input
                    type="text"
                    readOnly
                    value="•••• •••• •••• 8829"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded p-2 text-white font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-neutral-400 text-[11px] mb-1">Expiry Date</label>
                    <input
                      type="text"
                      readOnly
                      value="12/28"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded p-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-400 text-[11px] mb-1">CVC / Security Code</label>
                    <input
                      type="text"
                      readOnly
                      value="•••"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded p-2 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Verified Badge Status Indicator */}
              <div className="p-3 bg-[#131313] rounded-xl border border-neutral-800 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                  <span className="text-neutral-300 font-medium">External Trust Rating:</span>
                </div>
                <span className="font-mono text-[#D4AF37] font-bold">
                  {sessionData.verifiedStatus.trustScore}/100 Score (Verified)
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  className="flex-1 py-3.5 bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#B59226] text-black font-bold text-sm rounded-xl shadow-lg hover:shadow-[0_0_25px_rgba(212,175,55,0.4)] transition-all cursor-pointer"
                >
                  CONFIRM & PAY R{amountToPayNow.toLocaleString()} ZAR
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Processing Loading State */}
          {step === 3 && (
            <div className="py-12 text-center space-y-4">
              <div className="relative inline-flex items-center justify-center w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-[#D4AF37] border-t-transparent animate-spin" />
                <Sparkles className="w-8 h-8 text-[#D4AF37]" />
              </div>
              <h4 className="text-lg font-serif font-bold text-white">Authorizing Reservation Payment...</h4>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Locking Booth {stall.code} for {companyName} and attaching the "Verified" Business Trust Badge.
              </p>
            </div>
          )}

          {/* STEP 4: Success Pass & Downloadable Invoice */}
          {step === 4 && completedBooking && (
            <div className="space-y-5 text-center py-2">
              <div className="w-16 h-16 rounded-full bg-[#1F1A0E] border-2 border-[#D4AF37] text-[#D4AF37] flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(212,175,55,0.4)]">
                <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
              </div>

              <div>
                <h3 className="text-2xl font-serif font-bold text-white">Booking Confirmed!</h3>
                <p className="text-xs text-neutral-300 mt-1">
                  Welcome to <strong className="text-[#D4AF37]">Silver Crest Connect 2026</strong>.
                </p>
              </div>

              {/* Digital Pass Card */}
              <div className="bg-[#0A0A0A] border border-[#D4AF37]/50 rounded-2xl p-5 text-left relative overflow-hidden shadow-xl">
                <div className="flex items-center justify-between border-b border-[#262626] pb-3 mb-3">
                  <div>
                    <div className="text-xs font-mono text-[#D4AF37] font-bold">
                      {completedBooking.bookingCode}
                    </div>
                    <div className="text-base font-bold text-white">
                      {completedBooking.companyName}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 rounded bg-[#D4AF37]/20 text-[#D4AF37] text-xs font-mono font-bold border border-[#D4AF37]/40">
                      BOOTH {completedBooking.stallCode}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono mb-4">
                  <div>
                    <div className="text-neutral-500 text-[10px]">EXHIBITION HALL</div>
                    <div className="text-white font-semibold">{completedBooking.stallHall}</div>
                  </div>
                  <div>
                    <div className="text-neutral-500 text-[10px]">INVOICE NUMBER</div>
                    <div className="text-white font-semibold">{completedBooking.invoiceNumber}</div>
                  </div>
                </div>

                {/* QR Code and Trust Badge */}
                <div className="bg-black p-3 rounded-xl border border-neutral-800 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={completedBooking.qrCodeUrl}
                      alt="Booking QR Code"
                      className="w-16 h-16 rounded border border-neutral-700 bg-white p-1"
                    />
                    <div className="text-xs text-left">
                      <div className="font-bold text-white flex items-center gap-1">
                        <QrCode className="w-3.5 h-3.5 text-[#D4AF37]" />
                        Official Exhibitor Pass
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">
                        Scan at Silver Crest Registration desk
                      </div>
                    </div>
                  </div>

                  {completedBooking.verifiedBadgeAttached && (
                    <div className="text-right">
                      <div className="inline-flex items-center gap-1 text-[11px] text-[#D4AF37] font-bold bg-[#1F1A0E] border border-[#D4AF37]/40 px-2.5 py-1 rounded-lg">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Verified Badge
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-gradient-to-r from-[#D4AF37] to-[#B59226] text-black font-bold text-xs rounded-xl shadow-lg hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] cursor-pointer"
                >
                  DONE & RETURN TO FLOOR MAP
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
