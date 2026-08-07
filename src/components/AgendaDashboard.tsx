import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Bookmark,
  BookmarkCheck,
  ShieldCheck,
  Sparkles,
  Search,
  Filter,
  Radio,
  X,
  MessageSquare,
  Building,
} from 'lucide-react';

export interface Speaker {
  id: string;
  name: string;
  title: string;
  company: string;
  avatarUrl: string;
  bio: string;
  trustScore: number;
  isVerified: boolean;
  linkedin?: string;
  boothCode?: string;
}

export interface AgendaSession {
  id: string;
  title: string;
  subtitle: string;
  day: string; // e.g., 'Oct 12, 2026'
  timeSlot: string; // e.g., '09:00 AM - 10:15 AM'
  location: string; // e.g., 'Grand Ballroom Main Stage'
  track: 'Main Stage Keynotes' | 'SME Workshops' | 'Networking Mixers' | 'VIP Executive Track';
  isLive?: boolean;
  description: string;
  speakers: Speaker[];
  capacity: number;
  tags: string[];
}

export const MOCK_AGENDA_SESSIONS: AgendaSession[] = [
  {
    id: 'sess-1',
    title: 'Keynote Address: The Future of B2B Scale & Smart Enterprise Infrastructure',
    subtitle: 'Opening Ceremony & Grand Vision for 2026 and Beyond',
    day: 'Oct 12, 2026',
    timeSlot: '09:00 AM - 10:15 AM',
    location: 'Grand Ballroom Main Stage',
    track: 'Main Stage Keynotes',
    isLive: true,
    description: 'Join Marcus Vance and industry leaders as they unveil the new roadmap for enterprise digital transformation, API verification networks, and regional trade syndication.',
    speakers: [
      {
        id: 'spk-1',
        name: 'Marcus Vance',
        title: 'Managing Director & Founder',
        company: 'Silver Crest Innovations',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
        bio: 'Pioneering smart venue architectures and verified business networks. Has scaled multiple B2B enterprises across North America.',
        trustScore: 98,
        isVerified: true,
        boothCode: 'A-102',
      },
      {
        id: 'spk-2',
        name: 'Elena Rostova',
        title: 'Managing Partner & VP Investment',
        company: 'Crest Capital Group',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
        bio: 'Oversees R400M private equity allocations in high-growth technology and regional manufacturing hubs.',
        trustScore: 98,
        isVerified: true,
        boothCode: 'VIP-01',
      },
    ],
    capacity: 1200,
    tags: ['Keynote', 'B2B Strategy', 'Private Equity', 'API Integration'],
  },
  {
    id: 'sess-2',
    title: 'High-Concurrency Systems & Verified Business Architecture',
    subtitle: 'Technical Masterclass on Zero-Trust Identity and Real-Time Locks',
    day: 'Oct 12, 2026',
    timeSlot: '10:45 AM - 12:00 PM',
    location: 'Hall A Innovation Stage',
    track: 'SME Workshops',
    isLive: false,
    description: 'An in-depth breakdown of how the VerifiedBizLink network enforces 98+ trust scores, prevents duplicate booth holds, and scales API webhooks under heavy summit traffic.',
    speakers: [
      {
        id: 'spk-3',
        name: 'Alistair Vance',
        title: 'Chief Technology Officer',
        company: 'Vance Tech Solutions',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
        bio: 'Expert in high-throughput cloud architectures, serverless edge networks, and cryptographically verified business profiles.',
        trustScore: 99,
        isVerified: true,
        boothCode: 'A-101',
      },
    ],
    capacity: 350,
    tags: ['Cloud Architecture', 'Security', 'APIs', 'VerifiedBizLink'],
  },
  {
    id: 'sess-3',
    title: 'Executive VIP Luncheon & B2B Matchmaking Mixer',
    subtitle: 'Curated 1-on-1 Coffee & Venture Roundtables',
    day: 'Oct 12, 2026',
    timeSlot: '12:15 PM - 01:45 PM',
    location: 'VIP Executive Terrace & Lounge',
    track: 'VIP Executive Track',
    isLive: false,
    description: 'Exclusive networking experience connecting verified exhibitors with institutional investors, venture partners, and municipal decision-makers.',
    speakers: [
      {
        id: 'spk-4',
        name: 'Elena Rostova',
        title: 'Managing Partner',
        company: 'Crest Capital Group',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
        bio: 'Managing Partner focusing on Series A & B venture investments.',
        trustScore: 98,
        isVerified: true,
        boothCode: 'VIP-01',
      },
    ],
    capacity: 200,
    tags: ['Networking', 'Venture Capital', 'VIP Only', 'Matchmaking'],
  },
  {
    id: 'sess-4',
    title: 'Decarbonization & Clean Hardware Innovation in Supply Chains',
    subtitle: 'Panel Discussion & Live Equipment Demonstration',
    day: 'Oct 13, 2026',
    timeSlot: '02:00 PM - 03:30 PM',
    location: 'Hall B Tech & SME Workshop Room 1',
    track: 'SME Workshops',
    isLive: false,
    description: 'Discover how green hardware automation and IoT tracking reduce operational overhead by 40% in industrial manufacturing.',
    speakers: [
      {
        id: 'spk-5',
        name: 'Dr. Kwame Osei',
        title: 'Research Director',
        company: 'Apex Green Dynamics',
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
        bio: 'Leading researcher in renewable grid hardware and ESG compliance software.',
        trustScore: 97,
        isVerified: true,
        boothCode: 'B-103',
      },
      {
        id: 'spk-6',
        name: 'Sarah Jenkins',
        title: 'VP of Global Procurement',
        company: 'Horizon Logistics Corp',
        avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
        bio: 'Directs procurement and supply chain modernization for international fleet operations.',
        trustScore: 95,
        isVerified: true,
      },
    ],
    capacity: 400,
    tags: ['Clean Tech', 'Supply Chain', 'Automation', 'ESG'],
  },
  {
    id: 'sess-5',
    title: 'Exhibitor Showcase & Silver Crest Connect Award Gala',
    subtitle: 'Celebrating Outstanding B2B SME Growth & Innovation',
    day: 'Oct 13, 2026',
    timeSlot: '05:30 PM - 08:00 PM',
    location: 'Grand Ballroom Main Stage',
    track: 'Networking Mixers',
    isLive: false,
    description: 'Formal gala dinner and awards presentation recognizing top-performing exhibitors, premier sponsors, and innovative solution providers.',
    speakers: [
      {
        id: 'spk-1',
        name: 'Marcus Vance',
        title: 'Managing Director & Founder',
        company: 'Silver Crest Innovations',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
        bio: 'Managing Director & Founder presenting the 2026 Silver Crest Awards.',
        trustScore: 98,
        isVerified: true,
        boothCode: 'A-102',
      },
    ],
    capacity: 1000,
    tags: ['Gala Dinner', 'Awards', 'Exhibitor Showcase', 'Networking'],
  },
];

interface AgendaDashboardProps {
  onNavigateToNetworking?: (speakerName?: string) => void;
}

export const AgendaDashboard: React.FC<AgendaDashboardProps> = ({ onNavigateToNetworking }) => {
  const [selectedTrack, setSelectedTrack] = useState<string>('ALL');
  const [selectedDay, setSelectedDay] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [savedItineraryIds, setSavedItineraryIds] = useState<string[]>(['sess-1', 'sess-3']);
  const [viewSavedOnly, setViewSavedOnly] = useState<boolean>(false);

  // Selected Speaker for Detail Modal
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null);

  const tracks = [
    'ALL',
    'Main Stage Keynotes',
    'SME Workshops',
    'Networking Mixers',
    'VIP Executive Track',
  ];

  const days = ['ALL', 'Oct 12, 2026', 'Oct 13, 2026', 'Oct 14, 2026'];

  const toggleSavedItinerary = (id: string) => {
    setSavedItineraryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredSessions = MOCK_AGENDA_SESSIONS.filter((sess) => {
    if (viewSavedOnly && !savedItineraryIds.includes(sess.id)) return false;
    if (selectedTrack !== 'ALL' && sess.track !== selectedTrack) return false;
    if (selectedDay !== 'ALL' && sess.day !== selectedDay) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        sess.title.toLowerCase().includes(q) ||
        sess.subtitle.toLowerCase().includes(q) ||
        sess.description.toLowerCase().includes(q) ||
        sess.location.toLowerCase().includes(q) ||
        sess.speakers.some(
          (spk) =>
            spk.name.toLowerCase().includes(q) ||
            spk.company.toLowerCase().includes(q)
        )
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Itinerary Bar */}
      <div className="bg-[#121212] border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#D4AF37]" />
              <h2 className="text-lg font-light tracking-[0.2em] uppercase text-white">
                Event Agenda <span className="font-bold text-[#D4AF37]">& Keynote Schedule</span>
              </h2>
            </div>
            <p className="text-xs text-white/50 uppercase tracking-widest mt-1">
              Grand Ballroom & Multi-Hall Exhibition Tracks &bull; Oct 12-14, 2026
            </p>
          </div>

          {/* Saved Itinerary Toggle Pill */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewSavedOnly(!viewSavedOnly)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                viewSavedOnly
                  ? 'bg-[#D4AF37] text-black shadow-[0_0_20px_rgba(212,175,55,0.3)]'
                  : 'bg-black/60 border border-white/15 text-white/80 hover:border-[#D4AF37]/50'
              }`}
            >
              {viewSavedOnly ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4 text-[#D4AF37]" />}
              <span>My Itinerary ({savedItineraryIds.length})</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search keynotes, speakers, topics, or hall locations..."
                className="w-full bg-black/60 border border-white/15 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-white/30 focus:border-[#D4AF37] focus:outline-none"
              />
            </div>

            {/* Day Switcher */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {days.map((day) => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`px-3.5 py-2 rounded-xl text-[11px] font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                    selectedDay === day
                      ? 'bg-[#D4AF37]/20 border border-[#D4AF37] text-[#D4AF37]'
                      : 'bg-black/40 border border-white/10 text-white/50 hover:text-white'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Track Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto text-xs text-white/40">
            <Filter className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="text-[10px] uppercase font-bold text-white/60">Tracks:</span>
            {tracks.map((tr) => (
              <button
                key={tr}
                onClick={() => setSelectedTrack(tr)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                  selectedTrack === tr
                    ? 'bg-[#D4AF37] text-black font-bold shadow-[0_0_12px_rgba(212,175,55,0.2)]'
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
              >
                {tr}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dynamic Timeline Stream */}
      <div className="space-y-6">
        {filteredSessions.length > 0 ? (
          filteredSessions.map((session, index) => {
            const isSaved = savedItineraryIds.includes(session.id);

            return (
              <div
                key={session.id}
                className={`bg-[#121212] border rounded-2xl p-6 transition-all duration-300 relative overflow-hidden group ${
                  session.isLive
                    ? 'border-[#D4AF37] shadow-[0_0_25px_rgba(212,175,55,0.2)] bg-gradient-to-r from-[#18150A] via-[#121212] to-[#121212]'
                    : 'border-white/10 hover:border-white/30'
                }`}
              >
                {/* Live Broadcast Badge */}
                {session.isLive && (
                  <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 bg-[#D4AF37]/20 border border-[#D4AF37] text-[#D4AF37] rounded-full text-[10px] font-mono font-bold uppercase tracking-wider animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-ping" />
                    <Radio className="w-3 h-3 text-[#D4AF37]" />
                    <span>LIVE SESSION NOW</span>
                  </div>
                )}

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  {/* Left Column: Time & Location */}
                  <div className="md:w-64 shrink-0 space-y-2 border-b md:border-b-0 md:border-r border-white/10 pb-4 md:pb-0 md:pr-6">
                    <div className="flex items-center gap-2 text-white font-mono text-xs font-bold">
                      <Clock className="w-4 h-4 text-[#D4AF37]" />
                      <span>{session.timeSlot}</span>
                    </div>

                    <div className="flex items-center gap-2 text-white/60 text-xs">
                      <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>{session.location}</span>
                    </div>

                    <div className="pt-2">
                      <span className="inline-block px-2.5 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-white/70 uppercase">
                        {session.track}
                      </span>
                    </div>

                    <p className="text-[10px] font-mono text-white/40 pt-1">
                      {session.day} &bull; Cap: {session.capacity} Attendees
                    </p>
                  </div>

                  {/* Middle Column: Title, Description & Speakers */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-white tracking-wide group-hover:text-[#D4AF37] transition-colors">
                        {session.title}
                      </h3>
                      <p className="text-xs font-medium text-[#D4AF37] mt-0.5">
                        {session.subtitle}
                      </p>
                    </div>

                    <p className="text-xs text-white/70 leading-relaxed font-light">
                      {session.description}
                    </p>

                    {/* Speaker Profiles Row */}
                    <div className="space-y-2 pt-2">
                      <span className="text-[10px] uppercase font-bold text-white/40 font-mono">Featured Speakers:</span>
                      <div className="flex flex-wrap gap-3">
                        {session.speakers.map((spk) => (
                          <button
                            key={spk.id}
                            onClick={() => setSelectedSpeaker(spk)}
                            className="flex items-center gap-2.5 p-2 bg-black/50 border border-white/10 hover:border-[#D4AF37] rounded-xl text-left transition-all hover:scale-[1.02]"
                          >
                            <img
                              src={spk.avatarUrl}
                              alt={spk.name}
                              className="w-8 h-8 rounded-lg object-cover border border-[#D4AF37]/40"
                            />
                            <div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-bold text-white">{spk.name}</span>
                                {spk.isVerified && (
                                  <ShieldCheck className="w-3 h-3 text-[#D4AF37]" />
                                )}
                              </div>
                              <span className="text-[10px] text-white/50 block">{spk.company}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {session.tags.map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          className="text-[9px] px-2 py-0.5 bg-black/60 border border-white/10 text-white/60 rounded font-mono"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Add to Itinerary CTA */}
                  <div className="shrink-0 flex flex-col justify-between items-end gap-3 pt-2 md:pt-0">
                    <button
                      onClick={() => toggleSavedItinerary(session.id)}
                      className={`w-full md:w-auto px-4 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 ${
                        isSaved
                          ? 'bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:bg-[#c4a130]'
                          : 'bg-black/80 border border-white/20 text-white hover:border-[#D4AF37] hover:text-[#D4AF37]'
                      }`}
                    >
                      {isSaved ? (
                        <>
                          <BookmarkCheck className="w-4 h-4 text-black" />
                          <span>In My Itinerary</span>
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-4 h-4 text-[#D4AF37]" />
                          <span>+ Add to Itinerary</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-[#121212] border border-white/10 rounded-2xl p-12 text-center text-white/40 space-y-3">
            <Calendar className="w-10 h-10 text-[#D4AF37] mx-auto" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Sessions Found</h3>
            <p className="text-xs">Try adjusting your track filter or search query to see more events.</p>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* SPEAKER DETAIL MODAL                                                */}
      {/* ------------------------------------------------------------------- */}
      {selectedSpeaker && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121212] border-2 border-[#D4AF37] rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 relative shadow-[0_0_40px_rgba(212,175,55,0.25)]">
            <button
              onClick={() => setSelectedSpeaker(null)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 border-b border-white/10 pb-4">
              <img
                src={selectedSpeaker.avatarUrl}
                alt={selectedSpeaker.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-[#D4AF37]"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base font-bold text-white tracking-wide">{selectedSpeaker.name}</h3>
                  {selectedSpeaker.isVerified && (
                    <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                  )}
                </div>
                <p className="text-xs text-[#D4AF37] font-medium">{selectedSpeaker.title}</p>
                <p className="text-[10px] text-white/50 uppercase tracking-widest">{selectedSpeaker.company}</p>
              </div>
            </div>

            {/* Verified Network Badge */}
            <div className="p-3 bg-[#D4AF37]/10 border border-[#D4AF37]/40 rounded-xl flex items-center justify-between text-xs text-white">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                <span className="font-semibold text-[11px]">VerifiedBizLink Executive Profile</span>
              </div>
              <span className="font-mono text-[10px] font-bold text-[#D4AF37] bg-black/60 px-2 py-0.5 rounded">
                Trust Score: {selectedSpeaker.trustScore}/100
              </span>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-white/40 font-mono">Speaker Biography:</span>
              <p className="text-xs text-white/80 leading-relaxed font-light">
                {selectedSpeaker.bio}
              </p>
            </div>

            {selectedSpeaker.boothCode && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-mono font-bold">
                <Building className="w-4 h-4" />
                <span>Exhibiting at Stall {selectedSpeaker.boothCode}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-2 space-y-2">
              <button
                onClick={() => {
                  setSelectedSpeaker(null);
                  if (onNavigateToNetworking) {
                    onNavigateToNetworking(selectedSpeaker.name);
                  }
                }}
                className="w-full py-3.5 bg-[#D4AF37] text-black font-bold uppercase tracking-wider text-xs rounded-xl hover:bg-[#c4a130] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(212,175,55,0.3)]"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Connect in Matchmaking Hub</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const EventAgendaHub = AgendaDashboard;
