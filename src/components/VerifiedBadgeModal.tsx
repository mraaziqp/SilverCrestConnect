import React from 'react';
import { ShieldCheck, X, CheckCircle2, Award, Lock } from 'lucide-react';

interface VerifiedBadgeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VerifiedBadgeModal: React.FC<VerifiedBadgeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#121212] border border-[#D4AF37]/50 rounded-2xl w-full max-w-xl p-6 shadow-[0_0_50px_rgba(212,175,55,0.2)] relative space-y-5">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#1F1A0E] border border-[#D4AF37]/40 text-[#D4AF37] flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-serif font-bold text-white">
              API-First "Verified" Business Trust Badges
            </h3>
            <p className="text-xs text-[#D4AF37] font-mono">
              External Business Verification Platform Integration
            </p>
          </div>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed">
          Silver Crest Connect incorporates an API-first connection to <strong className="text-white font-semibold font-mono">"Verified"</strong> — an external business validation platform. When exhibitors enter their Tax ID/EIN during stall reservation, our backend performs real-time registry queries.
        </p>

        <div className="space-y-3 font-mono text-xs">
          <div className="p-3 bg-black rounded-xl border border-neutral-800 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-[#D4AF37] flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-white font-bold">State & Federal Registration Audit</div>
              <div className="text-[11px] text-neutral-400">Verifies corporate active status, state tax standing, and incorporation date.</div>
            </div>
          </div>

          <div className="p-3 bg-black rounded-xl border border-neutral-800 flex items-start gap-3">
            <Award className="w-4 h-4 text-[#D4AF37] flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-white font-bold">Floor Map Gold Badge Display</div>
              <div className="text-[11px] text-neutral-400">Exhibitors with verified badges gain a Gold Trust Badge on their interactive floor plan tile.</div>
            </div>
          </div>

          <div className="p-3 bg-black rounded-xl border border-neutral-800 flex items-start gap-3">
            <Lock className="w-4 h-4 text-[#D4AF37] flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-white font-bold">Encrypted Tax ID Handling</div>
              <div className="text-[11px] text-neutral-400">Tax IDs are verified in memory via TLS 1.3 and never stored as plain text.</div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-gradient-to-r from-[#D4AF37] to-[#B59226] text-black font-bold text-xs rounded-xl shadow-lg hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] cursor-pointer"
        >
          CLOSE & RETURN TO STALL BOOKING ENGINE
        </button>
      </div>
    </div>
  );
};
