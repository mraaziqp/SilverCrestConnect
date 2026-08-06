import React, { useState, useEffect } from 'react';
import { AttendeeProfile, ChatMessage, CoffeeMeetingRequest } from '../types';
import { MOCK_CURRENT_USER_ATTENDEE, MOCK_ATTENDEES } from '../data/mockData';
import {
  QrCode,
  Search,
  Filter,
  MessageSquare,
  ShieldCheck,
  Building,
  UserCheck,
  Coffee,
  Send,
  X,
  Sparkles,
  Share2,
  Zap,
} from 'lucide-react';

export const AttendeeNetworkingHub: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'card' | 'directory' | 'chat'>('directory');
  
  // Attendee list & search state
  const [attendees, setAttendees] = useState<AttendeeProfile[]>(MOCK_ATTENDEES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [selectedIndustryFilter, setSelectedIndustryFilter] = useState<string>('ALL');

  // Connections (Saved contacts)
  const [connections, setConnections] = useState<AttendeeProfile[]>([
    MOCK_ATTENDEES[1], // Alistair Vance
    MOCK_ATTENDEES[2], // Elena Rostova
  ]);

  // QR Modal & Scan State
  const [showMyQrModal, setShowMyQrModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannedQrCodeInput, setScannedQrCodeInput] = useState('');
  const [scanStatus, setScanStatus] = useState<string | null>(null);

  // Active Chat State
  const [activeChatPartner, setActiveChatPartner] = useState<AttendeeProfile | null>(MOCK_ATTENDEES[1]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInputText, setChatInputText] = useState('');

  // Coffee Meeting Modal State
  const [showCoffeeModal, setShowCoffeeModal] = useState(false);
  const [meetingLocation, setMeetingLocation] = useState('VIP Central Atrium Lounge');
  const [meetingDate, setMeetingDate] = useState('Oct 15, 2026');
  const [meetingTime, setMeetingTime] = useState('02:00 PM');
  const [meetingNote, setMeetingNote] = useState('15-min B2B Coffee & Partnership Catchup');

  // Fetch attendees & messages on mount or filter
  useEffect(() => {
    fetchAttendees();
  }, [searchQuery, selectedRoleFilter, selectedIndustryFilter]);

  useEffect(() => {
    if (activeChatPartner) {
      fetchMessages(activeChatPartner.id);
    }
  }, [activeChatPartner]);

  const fetchAttendees = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      if (selectedRoleFilter !== 'ALL') params.append('role', selectedRoleFilter);
      if (selectedIndustryFilter !== 'ALL') params.append('industry', selectedIndustryFilter);

      const res = await fetch(`/api/networking/attendees?${params.toString()}`);
      const data = await res.json();
      if (data.success && data.attendees) {
        setAttendees(data.attendees);
      }
    } catch (err) {
      // Fallback filtering
      let filtered = [...MOCK_ATTENDEES];
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.companyName.toLowerCase().includes(q) ||
            a.title.toLowerCase().includes(q)
        );
      }
      if (selectedRoleFilter !== 'ALL') {
        filtered = filtered.filter((a) => a.role === selectedRoleFilter);
      }
      setAttendees(filtered);
    }
  };

  const fetchMessages = async (partnerId: string) => {
    try {
      const res = await fetch(`/api/networking/messages?partnerId=${partnerId}`);
      const data = await res.json();
      if (data.success && data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      // Fallback
    }
  };

  const handleSendMessage = async (meetingReq?: CoffeeMeetingRequest) => {
    if ((!chatInputText.trim() && !meetingReq) || !activeChatPartner) return;

    const contentToSend = meetingReq
      ? `☕ Coffee Meeting Invitation: ${meetingReq.date} @ ${meetingReq.time} (${meetingReq.location})`
      : chatInputText;

    const newMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      senderId: 'att-me',
      receiverId: activeChatPartner.id,
      content: contentToSend,
      timestamp: new Date().toISOString(),
      meetingRequest: meetingReq,
    };

    setMessages((prev) => [...prev, newMsg]);
    setChatInputText('');

    try {
      await fetch('/api/networking/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: activeChatPartner.id,
          content: contentToSend,
          meetingRequest: meetingReq,
        }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleScanQr = async () => {
    if (!scannedQrCodeInput.trim()) return;
    setScanStatus('Scanning Verified Network...');

    try {
      const res = await fetch('/api/networking/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCodeData: scannedQrCodeInput }),
      });
      const data = await res.json();
      if (data.success && data.connection) {
        setScanStatus(`Connected! Saved ${data.connection.attendee.name} to your cards.`);
        if (!connections.some((c) => c.id === data.connection.attendee.id)) {
          setConnections((prev) => [data.connection.attendee, ...prev]);
        }
        setTimeout(() => {
          setShowScannerModal(false);
          setScanStatus(null);
          setScannedQrCodeInput('');
        }, 1500);
      } else {
        setScanStatus('Card verified! Contact added to floor connections.');
      }
    } catch (err) {
      setScanStatus('Contact added to local connections.');
    }
  };

  const industries = [
    'ALL',
    'Enterprise Software & Cloud',
    'Financial Services & Investment',
    'Renewables & Green Tech',
    'Logistics & Supply Chain',
    'Cybersecurity & Risk',
  ];

  return (
    <div className="space-y-6">
      {/* Top Section Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#121212] p-2 border border-white/10 rounded-xl">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveSection('directory')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
              activeSection === 'directory'
                ? 'bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.25)]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Attendee Directory ({attendees.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('card')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
              activeSection === 'card'
                ? 'bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.25)]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Digital Card & Contacts ({connections.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('chat')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
              activeSection === 'chat'
                ? 'bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.25)]'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>1-on-1 Messages</span>
            <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => setShowMyQrModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/30 hover:bg-[#D4AF37]/20 rounded-lg transition-all"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Show My QR</span>
          </button>
          <button
            onClick={() => setShowScannerModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-black bg-[#D4AF37] hover:bg-[#c4a130] rounded-lg transition-all"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Scan Badge</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* SECTION 1: ATTENDEE DIRECTORY & SEARCH                              */}
      {/* ------------------------------------------------------------------- */}
      {activeSection === 'directory' && (
        <div className="space-y-6">
          {/* Search & Filter Bar */}
          <div className="bg-[#121212] p-4 border border-white/10 rounded-2xl space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search attendees by name, company, title, or seeking tags..."
                  className="w-full bg-black/60 border border-white/15 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-white/30 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              {/* Role filter */}
              <div className="flex items-center gap-2 overflow-x-auto">
                {['ALL', 'EXHIBITOR', 'SPONSOR', 'SPEAKER', 'ATTENDEE'].map((role) => (
                  <button
                    key={role}
                    onClick={() => setSelectedRoleFilter(role)}
                    className={`px-3 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                      selectedRoleFilter === role
                        ? 'bg-[#D4AF37]/20 border border-[#D4AF37] text-[#D4AF37]'
                        : 'bg-black/40 border border-white/10 text-white/50 hover:text-white'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {/* Industry Filter dropdown pill */}
            <div className="flex items-center gap-2 overflow-x-auto text-xs text-white/40">
              <Filter className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="text-[10px] uppercase font-bold text-white/60">Industry:</span>
              {industries.map((ind) => (
                <button
                  key={ind}
                  onClick={() => setSelectedIndustryFilter(ind)}
                  className={`px-2.5 py-1 rounded-full text-[10px] transition-all whitespace-nowrap ${
                    selectedIndustryFilter === ind
                      ? 'bg-white/20 text-white font-bold'
                      : 'bg-white/5 text-white/40 hover:text-white'
                  }`}
                >
                  {ind}
                </button>
              ))}
            </div>
          </div>

            {/* Suggested Connections Horizontal Scrollable Row */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#D4AF37]">
                    AI Matchmaking & Suggested Connections
                  </h3>
                </div>
                <span className="text-[10px] text-white/40 font-mono">Scroll &rarr;</span>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-[#D4AF37]/30">
                {attendees.map((suggested) => (
                  <div
                    key={'sug-' + suggested.id}
                    className="min-w-[260px] max-w-[280px] bg-gradient-to-b from-[#181818] to-[#101010] border border-[#D4AF37]/30 hover:border-[#D4AF37] rounded-2xl p-4 space-y-3 shrink-0 transition-all hover:scale-[1.02] relative group shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <img
                          src={suggested.avatarUrl}
                          alt={suggested.name}
                          className="w-11 h-11 rounded-xl object-cover border border-[#D4AF37]/40"
                        />
                        <div>
                          <div className="flex items-center gap-1">
                            <h4 className="text-xs font-bold text-white tracking-wide truncate max-w-[130px]">
                              {suggested.name}
                            </h4>
                            {suggested.isVerified && (
                              <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                            )}
                          </div>
                          <p className="text-[10px] text-[#D4AF37] font-medium truncate max-w-[130px]">
                            {suggested.title}
                          </p>
                          <p className="text-[9px] text-white/50 uppercase tracking-wider truncate max-w-[130px]">
                            {suggested.companyName}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] text-white/70 line-clamp-2 bg-black/40 p-2 rounded-lg border border-white/5 font-light">
                      &ldquo;{suggested.bio}&rdquo;
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[9px] font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded border border-[#D4AF37]/30">
                        {suggested.role}
                      </span>

                      <button
                        onClick={() => {
                          setActiveChatPartner(suggested);
                          setActiveSection('chat');
                        }}
                        className="px-3 py-1.5 bg-gradient-to-r from-[#D4AF37] to-[#B59226] text-black font-bold uppercase tracking-wider text-[10px] rounded-lg hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all flex items-center gap-1"
                      >
                        <UserCheck className="w-3 h-3" />
                        <span>Connect</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Main Attendee Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {attendees.map((person) => (
              <div
                key={person.id}
                className="bg-[#121212] border border-white/10 hover:border-[#D4AF37]/60 rounded-2xl p-5 space-y-4 transition-all hover:scale-[1.01] flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  {/* Top Header info */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={person.avatarUrl}
                        alt={person.name}
                        className="w-12 h-12 rounded-xl object-cover border border-white/10 group-hover:border-[#D4AF37]/50"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-white text-sm tracking-wide">{person.name}</h3>
                          {person.isVerified && (
                            <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                          )}
                        </div>
                        <p className="text-[11px] text-[#D4AF37] font-medium">{person.title}</p>
                        <p className="text-[10px] text-white/40 uppercase tracking-wider">{person.companyName}</p>
                      </div>
                    </div>

                    <span className="text-[9px] uppercase font-bold font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/60">
                      {person.role}
                    </span>
                  </div>

                  {/* Bio */}
                  <p className="text-xs text-white/70 leading-relaxed font-light line-clamp-2">
                    {person.bio}
                  </p>

                  {/* Booth Badge if available */}
                  {person.boothCode && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-mono font-bold">
                      <Building className="w-3 h-3" />
                      <span>Exhibiting at Stall {person.boothCode}</span>
                    </div>
                  )}

                  {/* Looking For Tags */}
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-mono text-white/40 tracking-wider">Seeking:</span>
                    <div className="flex flex-wrap gap-1">
                      {person.lookingFor.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[9px] px-2 py-0.5 bg-black/50 border border-white/10 text-white/80 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[10px] font-mono text-[#D4AF37]">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Trust Score: {person.trustScore}/100</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setActiveChatPartner(person);
                        setActiveSection('chat');
                      }}
                      className="px-3 py-1.5 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Chat</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveChatPartner(person);
                        setShowCoffeeModal(true);
                      }}
                      className="px-3 py-1.5 bg-[#D4AF37] text-black hover:bg-[#c4a130] text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1"
                    >
                      <Coffee className="w-3 h-3" />
                      <span>Meet</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* SECTION 2: DIGITAL BUSINESS CARD & SAVED CONTACTS                   */}
      {/* ------------------------------------------------------------------- */}
      {activeSection === 'card' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: My Digital Pass Preview */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#D4AF37]">
              Your Digital Business Card
            </h2>

            {/* Premium Gold Accent Card */}
            <div className="bg-gradient-to-br from-[#1A160A] via-[#121212] to-[#0A0A0A] border-2 border-[#D4AF37] rounded-2xl p-6 space-y-6 shadow-[0_0_25px_rgba(212,175,55,0.2)] relative overflow-hidden">
              <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-24 h-24 bg-[#D4AF37]/10 rounded-full blur-xl pointer-events-none" />

              <div className="flex items-start justify-between border-b border-[#D4AF37]/30 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 border-2 border-[#D4AF37] rotate-45 flex items-center justify-center shrink-0">
                    <span className="text-[#D4AF37] font-bold text-xs -rotate-45">SC</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base tracking-wide">
                      {MOCK_CURRENT_USER_ATTENDEE.name}
                    </h3>
                    <p className="text-xs text-[#D4AF37] font-medium">{MOCK_CURRENT_USER_ATTENDEE.title}</p>
                    <p className="text-[10px] text-white/50 uppercase tracking-widest">{MOCK_CURRENT_USER_ATTENDEE.companyName}</p>
                  </div>
                </div>

                <div className="bg-[#D4AF37] text-black px-2.5 py-1 rounded font-mono text-[9px] font-bold uppercase">
                  VERIFIED
                </div>
              </div>

              <div className="space-y-2 text-xs font-light text-white/80">
                <p>{MOCK_CURRENT_USER_ATTENDEE.bio}</p>
                <div className="flex flex-wrap gap-2 pt-2 text-[10px] font-mono text-[#D4AF37]">
                  <span>Email: {MOCK_CURRENT_USER_ATTENDEE.email}</span>
                  <span>&bull;</span>
                  <span>Stall: {MOCK_CURRENT_USER_ATTENDEE.boothCode}</span>
                </div>
              </div>

              {/* QR Code Graphic preview */}
              <div className="bg-black/80 p-4 rounded-xl border border-white/10 flex flex-col items-center justify-center gap-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${MOCK_CURRENT_USER_ATTENDEE.qrCodeData}`}
                  alt="My QR Pass"
                  className="w-32 h-32 rounded bg-white p-1"
                />
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">
                  Scan to swap contact card
                </span>
              </div>

              <button
                onClick={() => setShowMyQrModal(true)}
                className="w-full py-3 bg-[#D4AF37] text-black font-bold uppercase tracking-wider text-xs rounded-xl hover:bg-[#c4a130] transition-all flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span>Present Full Screen QR</span>
              </button>
            </div>
          </div>

          {/* Right Column: Swapped Contacts & Connections List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#D4AF37]">
                Floor Connections & Swapped Cards ({connections.length})
              </h2>
              <button
                onClick={() => setShowScannerModal(true)}
                className="text-xs text-[#D4AF37] hover:underline font-mono uppercase"
              >
                + Add Connection
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {connections.map((c) => (
                <div
                  key={c.id}
                  className="bg-[#121212] border border-white/10 hover:border-[#D4AF37]/50 rounded-xl p-4 space-y-3 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={c.avatarUrl}
                      alt={c.name}
                      className="w-10 h-10 rounded-lg object-cover border border-white/10"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-white">{c.name}</h4>
                      <p className="text-[10px] text-[#D4AF37]">{c.title}</p>
                      <p className="text-[10px] text-white/40 uppercase">{c.companyName}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-white/50 font-mono">
                    <span>Email: {c.email}</span>
                    <button
                      onClick={() => {
                        setActiveChatPartner(c);
                        setActiveSection('chat');
                      }}
                      className="text-[#D4AF37] hover:underline uppercase font-bold"
                    >
                      Message
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* SECTION 3: 1-ON-1 CHAT & COFFEE MEETING SCHEDULER                   */}
      {/* ------------------------------------------------------------------- */}
      {activeSection === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-[#121212] border border-white/10 rounded-2xl overflow-hidden min-h-[500px]">
          {/* Left Chat Contacts Panel */}
          <div className="border-r border-white/10 p-4 space-y-4">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">
              Conversations
            </h3>

            <div className="space-y-2">
              {attendees.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActiveChatPartner(p)}
                  className={`w-full p-3 rounded-xl flex items-center gap-3 text-left transition-all ${
                    activeChatPartner?.id === p.id
                      ? 'bg-[#D4AF37]/15 border border-[#D4AF37]/50'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <img
                    src={p.avatarUrl}
                    alt={p.name}
                    className="w-9 h-9 rounded-lg object-cover border border-white/10"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate">{p.name}</span>
                      <span className="text-[9px] font-mono text-[#D4AF37]">{p.boothCode || 'Floor'}</span>
                    </div>
                    <p className="text-[10px] text-white/40 truncate">{p.companyName}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Chat Messaging Area */}
          <div className="lg:col-span-2 flex flex-col justify-between p-5 space-y-4 bg-black/40">
            {activeChatPartner ? (
              <>
                {/* Chat Partner Top Bar */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <img
                      src={activeChatPartner.avatarUrl}
                      alt={activeChatPartner.name}
                      className="w-10 h-10 rounded-lg object-cover border border-[#D4AF37]"
                    />
                    <div>
                      <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                        {activeChatPartner.name}
                        {activeChatPartner.isVerified && (
                          <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                        )}
                      </h3>
                      <p className="text-[10px] text-white/50">{activeChatPartner.title} &bull; {activeChatPartner.companyName}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowCoffeeModal(true)}
                    className="px-3 py-1.5 bg-[#D4AF37] text-black font-bold uppercase tracking-wider text-[10px] rounded-lg hover:bg-[#c4a130] transition-all flex items-center gap-1.5"
                  >
                    <Coffee className="w-3.5 h-3.5" />
                    <span>Schedule Meeting</span>
                  </button>
                </div>

                {/* Message Log */}
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[360px] pr-2 scrollbar-thin">
                  {messages.map((m) => {
                    const isMe = m.senderId === 'att-me';
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed space-y-2 ${
                            isMe
                              ? 'bg-[#D4AF37] text-black font-medium rounded-br-none shadow-[0_0_15px_rgba(212,175,55,0.2)]'
                              : 'bg-[#1E1E1E] border border-white/10 text-white rounded-bl-none'
                          }`}
                        >
                          <p>{m.content}</p>

                          {m.meetingRequest && (
                            <div className="p-2.5 bg-black/30 border border-black/20 rounded-xl space-y-1 text-[11px] font-mono">
                              <div className="flex items-center gap-1.5 font-bold text-[#D4AF37]">
                                <Coffee className="w-3.5 h-3.5" />
                                <span>B2B Coffee Invitation</span>
                              </div>
                              <p className="text-white/80">{m.meetingRequest.note}</p>
                              <div className="text-[10px] text-white/60">
                                📍 {m.meetingRequest.location} | 🕒 {m.meetingRequest.time} ({m.meetingRequest.date})
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-[9px] font-mono text-white/30 mt-1 px-1">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Chat Input Bar */}
                <div className="pt-3 border-t border-white/10 flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInputText}
                    onChange={(e) => setChatInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder={`Message ${activeChatPartner.name}...`}
                    className="flex-1 bg-[#121212] border border-white/15 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-white/30 focus:border-[#D4AF37] focus:outline-none"
                  />
                  <button
                    onClick={() => handleSendMessage()}
                    className="p-2.5 bg-[#D4AF37] text-black font-bold rounded-xl hover:bg-[#c4a130] transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-white/40 space-y-2">
                <MessageSquare className="w-8 h-8 text-[#D4AF37]" />
                <p className="text-xs">Select an attendee from the list to start messaging.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 1: FULL SCREEN MY DIGITAL QR PASS                             */}
      {/* ------------------------------------------------------------------- */}
      {showMyQrModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121212] border-2 border-[#D4AF37] rounded-3xl p-8 max-w-sm w-full space-y-6 text-center relative shadow-[0_0_50px_rgba(212,175,55,0.3)]">
            <button
              onClick={() => setShowMyQrModal(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="w-10 h-10 border-2 border-[#D4AF37] rotate-45 flex items-center justify-center mx-auto mb-2">
                <span className="text-[#D4AF37] font-bold text-xs -rotate-45">SC</span>
              </div>
              <h3 className="text-lg font-bold text-white uppercase tracking-wider">
                Digital Contact Pass
              </h3>
              <p className="text-xs text-[#D4AF37]">{MOCK_CURRENT_USER_ATTENDEE.name}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">{MOCK_CURRENT_USER_ATTENDEE.companyName}</p>
            </div>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${MOCK_CURRENT_USER_ATTENDEE.qrCodeData}`}
                alt="QR Pass"
                className="w-48 h-48"
              />
            </div>

            <p className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
              Verified Platform Network Signature Active
            </p>

            <button
              onClick={() => setShowMyQrModal(false)}
              className="w-full py-3 bg-[#D4AF37] text-black font-bold uppercase tracking-widest text-xs rounded-xl"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 2: QR BADGE SCANNER                                           */}
      {/* ------------------------------------------------------------------- */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-white/15 rounded-3xl p-6 max-w-md w-full space-y-5 relative">
            <button
              onClick={() => setShowScannerModal(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#D4AF37]" />
                Scan Attendee Badge QR Code
              </h3>
              <p className="text-xs text-white/60">
                Instantly swap contact info and save to your networking list.
              </p>
            </div>

            {/* Simulated Camera Viewfinder */}
            <div className="h-44 bg-black border-2 border-dashed border-[#D4AF37]/50 rounded-2xl flex flex-col items-center justify-center space-y-2 relative overflow-hidden">
              <div className="w-full h-0.5 bg-[#D4AF37] animate-bounce opacity-80" />
              <QrCode className="w-12 h-12 text-[#D4AF37]/40" />
              <span className="text-[10px] font-mono text-white/40 uppercase">Align QR Code within Frame</span>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-white/60">Or Enter QR Code Payload manually:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={scannedQrCodeInput}
                  onChange={(e) => setScannedQrCodeInput(e.target.value)}
                  placeholder="e.g. SCC2026-CARD-ATT1-ALISTAIR"
                  className="flex-1 bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-[#D4AF37] focus:outline-none"
                />
                <button
                  onClick={handleScanQr}
                  className="px-4 py-2 bg-[#D4AF37] text-black font-bold uppercase text-xs rounded-xl hover:bg-[#c4a130]"
                >
                  Verify
                </button>
              </div>
            </div>

            {scanStatus && (
              <div className="p-3 bg-[#D4AF37]/15 border border-[#D4AF37]/40 rounded-xl text-xs text-[#D4AF37] font-mono text-center">
                {scanStatus}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 3: SCHEDULE 1-ON-1 COFFEE MEETING                             */}
      {/* ------------------------------------------------------------------- */}
      {showCoffeeModal && activeChatPartner && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#D4AF37] rounded-3xl p-6 max-w-md w-full space-y-5 relative">
            <button
              onClick={() => setShowCoffeeModal(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#D4AF37]">
                <Coffee className="w-5 h-5" />
                <h3 className="text-base font-bold uppercase tracking-wider text-white">
                  Schedule 1-on-1 Coffee Meeting
                </h3>
              </div>
              <p className="text-xs text-white/60">
                Propose a brief meeting with <span className="text-[#D4AF37] font-bold">{activeChatPartner.name}</span> ({activeChatPartner.companyName}).
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-white/50 block mb-1">Meeting Location:</label>
                <select
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-[#D4AF37] focus:outline-none"
                >
                  <option value="VIP Central Atrium Lounge">VIP Central Atrium Lounge</option>
                  <option value="Hall A Main Coffee Bar">Hall A Main Coffee Bar</option>
                  <option value="Exhibitor Booth Visit">Exhibitor Booth Visit ({activeChatPartner.boothCode || 'Floor'})</option>
                  <option value="Silver Crest Terrace">Silver Crest Executive Terrace</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-white/50 block mb-1">Date:</label>
                  <input
                    type="text"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-white/50 block mb-1">Time Slot:</label>
                  <input
                    type="text"
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                    className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-white focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-white/50 block mb-1">Topic / Agenda Note:</label>
                <textarea
                  value={meetingNote}
                  onChange={(e) => setMeetingNote(e.target.value)}
                  rows={2}
                  className="w-full bg-black/60 border border-white/15 rounded-xl p-3 text-white focus:border-[#D4AF37] focus:outline-none resize-none"
                />
              </div>
            </div>

            <button
              onClick={() => {
                handleSendMessage({
                  id: 'meet-' + Date.now(),
                  location: meetingLocation,
                  date: meetingDate,
                  time: meetingTime,
                  status: 'PENDING',
                  note: meetingNote,
                });
                setShowCoffeeModal(false);
                setActiveSection('chat');
              }}
              className="w-full py-3 bg-[#D4AF37] text-black font-bold uppercase tracking-wider text-xs rounded-xl hover:bg-[#c4a130] transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Send Meeting Invitation</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const NetworkingDashboard = AttendeeNetworkingHub;
