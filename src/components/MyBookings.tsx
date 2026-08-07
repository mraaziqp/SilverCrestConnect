import React from 'react';
import { Booking } from '../types';
import { Ticket, QrCode, ShieldCheck, Download, Building2, Calendar, MapPin } from 'lucide-react';

interface MyBookingsProps {
  bookings: Booking[];
  onOpenFloorplan: () => void;
}

export const MyBookings: React.FC<MyBookingsProps> = ({ bookings, onOpenFloorplan }) => {
  return (
    <div className="space-y-6">
      <div className="bg-[#121212] border border-[#262626] rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-[#D4AF37]" />
            <h2 className="text-xl font-serif font-bold text-white">My Confirmed Passes & Receipts</h2>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Access digital entry passes, invoice receipts, and booth allocation credentials for Silver Crest Connect 2026.
          </p>
        </div>

        <button
          onClick={onOpenFloorplan}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B59226] text-black text-xs font-bold shadow-lg hover:shadow-[0_0_15px_rgba(212,175,55,0.3)] transition-all whitespace-nowrap cursor-pointer"
        >
          + Book Another Stall
        </button>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-[#121212] border border-[#262626] rounded-2xl p-12 text-center text-neutral-400">
          <Ticket className="w-12 h-12 text-[#D4AF37] mx-auto mb-3 opacity-60" />
          <h3 className="text-lg font-serif font-bold text-white mb-1">No Active Passes Found</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto mb-4">
            Select an available booth on the floor map to generate an instant digital pass and "Verified" trust badge.
          </p>
          <button
            onClick={onOpenFloorplan}
            className="px-4 py-2 bg-[#D4AF37] text-black text-xs font-bold rounded-xl"
          >
            Explore Floor Plan
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-[#121212] border border-[#D4AF37]/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#B59226]" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#262626]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#D4AF37]">
                      {booking.bookingCode}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800">
                      {booking.paymentStatus}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white font-serif">{booking.companyName}</h3>
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Silver Crest Connect &bull; October 14-16, 2026</span>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <div className="text-2xl font-extrabold text-[#D4AF37]">
                    BOOTH {booking.stallCode}
                  </div>
                  <div className="text-xs text-neutral-400">{booking.stallHall}</div>
                </div>
              </div>

              {/* Middle Pass Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6 text-xs">
                <div className="p-4 bg-black rounded-xl border border-neutral-800 space-y-2">
                  <div className="font-bold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#D4AF37]" />
                    <span>Booking Credentials</span>
                  </div>
                  <div className="text-neutral-400 font-mono">
                    <div>Contact: {booking.userName}</div>
                    <div>Email: {booking.userEmail}</div>
                    <div>Invoice: {booking.invoiceNumber}</div>
                  </div>
                </div>

                <div className="p-4 bg-black rounded-xl border border-neutral-800 space-y-2">
                  <div className="font-bold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#D4AF37]" />
                    <span>Tier & Financials</span>
                  </div>
                  <div className="text-neutral-400 font-mono">
                    <div>Tier: {booking.tier.replace('_', ' ')}</div>
                    <div>Total Package: R{booking.totalAmountZAR.toLocaleString()}</div>
                    <div>Paid Today: R{booking.amountPaidZAR.toLocaleString()}</div>
                  </div>
                </div>

                {/* QR Ticket */}
                <div className="p-4 bg-black rounded-xl border border-neutral-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5 mb-1">
                      <QrCode className="w-4 h-4 text-[#D4AF37]" />
                      <span>Digital Entrance Badge</span>
                    </div>
                    <div className="text-[11px] text-neutral-400 leading-tight">
                      Show at VIP Check-in Desk for fast-track badge printing.
                    </div>
                  </div>

                  <img
                    src={booking.qrCodeUrl}
                    alt="QR Pass"
                    className="w-16 h-16 rounded border border-neutral-700 bg-white p-1 flex-shrink-0"
                  />
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
                <div className="flex items-center gap-2 text-xs text-[#D4AF37] font-semibold bg-[#1F1A0E] px-3 py-1.5 rounded-lg border border-[#D4AF37]/30">
                  <ShieldCheck className="w-4 h-4" />
                  <span>"Verified" Platform Trust Badge Attached to Booth</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => alert(`Downloading Invoice PDF: ${booking.invoiceNumber}`)}
                    className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Download Invoice PDF</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
