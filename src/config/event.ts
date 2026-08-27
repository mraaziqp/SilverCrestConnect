/**
 * Single source of truth for all Silver Crest Connect '26 event facts.
 * Everything user-facing reads from here so copy never drifts between
 * the landing page, the emails, the admin dashboard and the API.
 *
 * Source: "Silvercrest_Connect_Proposal_v4.pdf" (Event Proposal & Concept Note).
 */

export const EVENT = {
  name: 'Silver Crest Connect',
  edition: "'26",
  fullName: "Silver Crest Connect '26",
  tagline: 'Building Business. Strengthening Community.',
  presentedBy: '',
  companyName: 'Silver Crest Consulting',
  hosts: ['Wesley Bosman', 'Saadiqah'],
  /** This event's own site. */
  website: 'https://scconnect.co.za',
  /** The parent consulting business. */
  companyWebsite: 'https://scconsults.co.za',

  /** 23 October 2026, 09:00 - 13:00 (SAST) */
  date: '2026-10-23',
  dateLabel: '23 October 2026',
  startTime: '09:00',
  endTime: '13:00',
  timeLabel: '09:00 – 13:00',
  timezone: 'Africa/Johannesburg',
  /** ISO instant of the event start, used for the countdown. SAST = UTC+2. */
  startsAtISO: '2026-10-23T09:00:00+02:00',

  city: 'Cape Town',
  venue: 'Venue to be confirmed',
  venueCity: 'Cape Town, South Africa',

  heroParagraph:
    'An exclusive half-day B2B networking showcase for local SME founders, where business growth directly supports community outreach.',
  aboutTitle: 'A room built for real business, funding real community work.',
  aboutLead:
    'Silver Crest Connect brings together local business founders for focused B2B networking. Every ticket sold directly funds our Year-End Community Outreach Drive with zero overheads retained.',
  aboutBody:
    'Curated introductions between founders, practical keynote sessions, and a dedicated SME Spotlight where each business owner has the floor to present their services.',

  /** Attendance fee per SME, in ZAR. 100% funds the outreach drive. */
  ticketPriceZAR: 450,
  /** The proposal caps the room at vetted SMEs. */
  capacityMin: 40,
  capacityMax: 50,
  /** Hard ceiling used by the server to stop overselling. */
  capacity: 50,

  cause: "Silver Crest's Year-End Community Outreach Drive",
  causeShort: 'Year-End Community Outreach Drive',

  contactEmail: 'connect@scconsults.co.za',
  contactPhone: '',

  footerNote:
    'All ticket proceeds and donations go directly towards supplies for the Year-End Community Outreach Drive. Nothing is held back for event overheads.',
  copyrightText: 'Silver Crest Connect. All rights reserved.',

  social: {
    linkedin: '',
    instagram: '',
    facebook: '',
  },
} as const;

/** The four cornerstones of the Connect experience (proposal, section 02). */
export const PILLARS = [
  {
    id: 'connect',
    title: 'Connect With Purpose',
    body: `Gathering ${EVENT.capacityMin}–${EVENT.capacityMax} selected local SME owners for curated, high-intent B2B networking and collaboration in a structured environment.`,
  },
  {
    id: 'learn',
    title: 'Learn From Experts',
    body: 'Four 15-minute high-impact keynote sessions delivered by guest speakers covering essential business growth and stability topics.',
  },
  {
    id: 'grow',
    title: 'Grow Your Business',
    body: 'Dedicated SME Spotlight segments allowing every attending business owner up to 2 minutes for an elevator speech and service showcase.',
  },
  {
    id: 'impact',
    title: 'Make An Impact',
    body: `100% of attendance proceeds (R${EVENT.ticketPriceZAR} per SME) directly fund ${EVENT.cause}.`,
  },
] as const;

/** Structured 4-hour agenda (proposal, section 03). */
export const PROGRAMME = [
  { id: 'prog-1', time: '09:00 – 09:30', duration: '30 mins', title: 'Arrival & Morning Connect', detail: 'Registration, tea/coffee & food stall networking.', kind: 'session' as const },
  { id: 'prog-2', time: '09:30 – 09:45', duration: '15 mins', title: 'Keynote Speaker #1', detail: 'Topic to be confirmed.', kind: 'keynote' as const },
  { id: 'prog-3', time: '09:45 – 10:30', duration: '45 mins', title: 'SME Spotlight — Round 1', detail: 'Elevator speeches, max 2 minutes per SME.', kind: 'spotlight' as const },
  { id: 'prog-4', time: '10:30 – 10:45', duration: '15 mins', title: 'Keynote Speaker #2', detail: 'Topic to be confirmed.', kind: 'keynote' as const },
  { id: 'prog-5', time: '10:45 – 11:30', duration: '45 mins', title: 'SME Spotlight — Round 2', detail: 'Floor browsing & vendor stall visits.', kind: 'spotlight' as const },
  { id: 'prog-6', time: '11:30 – 11:45', duration: '15 mins', title: 'Keynote Speaker #3', detail: 'Topic to be confirmed.', kind: 'keynote' as const },
  { id: 'prog-7', time: '11:45 – 12:30', duration: '45 mins', title: 'Open Floor Networking', detail: 'Open networking & food stall experience.', kind: 'session' as const },
  { id: 'prog-8', time: '12:30 – 12:45', duration: '15 mins', title: 'Keynote Speaker #4', detail: 'Topic to be confirmed.', kind: 'keynote' as const },
  { id: 'prog-9', time: '12:45 – 13:00', duration: '15 mins', title: 'Closing Remarks', detail: `${EVENT.causeShort} official announcement.`, kind: 'session' as const },
];

/** The three-step vetting funnel (proposal, section 04). */
/**
 * The public join funnel.
 *
 * `body` is a function of the ticket price rather than a fixed string: the
 * price is editable in the dashboard, and a hardcoded amount here would keep
 * advertising the old one. Numbering is derived from position so a step can be
 * added or removed without leaving the sequence wrong.
 */
export const FUNNEL_STEPS: ReadonlyArray<{
  title: string;
  body: (priceZAR: number) => string;
}> = [
  {
    title: 'Application Form',
    body: () =>
      'Business owners submit a concise online application with company details and industry sector.',
  },
  {
    title: 'Approval & Ticket',
    body: (priceZAR) =>
      `Approved SMEs receive a secure payment link to finalise the R${priceZAR} fee, followed by their official digital event ticket.`,
  },
];

/** On-site activation (proposal, section 05) — coffee cup removed. */
export const IMPACT_ITEMS = [
  { id: 'imp-1', title: 'Past Outreach Exhibition', body: "A poster board showcase displaying photos and impact metrics from Silver Crest's last community drive." },
  { id: 'imp-2', title: 'On-The-Day Contribution Jar', body: 'A branded, secure collection container at the Silver Crest stand for cash contributions throughout the morning.' },
  { id: 'imp-3', title: 'Instant QR Contributions', body: 'Scan-to-give displayed on the stand poster for seamless digital card contributions.' },
];

/** What every registered SME receives (proposal, section 06). */
export const WELCOME_PACK = [
  { id: 'wp-1', title: 'Custom Lanyard & Business Tag', body: 'Branded Silver Crest Connect lanyard with a custom badge showing business name and founder details.' },
  { id: 'wp-2', title: 'Executive Branded Pen', body: 'Sleek metallic executive pen custom-engraved with the Silver Crest Connect branding.' },
];

/** Default photos from the previous outreach drive shown beside the donation form. */
export const DEFAULT_GALLERY = [
  {
    id: 'photo-1',
    url: '/outreach/drive-pack-1.jpg',
    caption: 'Personal care and hygiene kits prepared for community distribution.',
  },
  {
    id: 'photo-2',
    url: '/outreach/drive-pack-2.jpg',
    caption: 'Winter warmth packages, knitted beanies, and daily toiletries.',
  },
  {
    id: 'photo-3',
    url: '/outreach/drive-pack-3.jpg',
    caption: 'Pantry staples, soup mixes, canned foods, and nutrition parcels.',
  },
  {
    id: 'photo-4',
    url: '/outreach/drive-pack-4.jpg',
    caption: 'Complete outreach care parcel with blankets, food supplies, and toiletries.',
  },
];

/** Preset donation amounts in ZAR offered on the Donate card. */
export const DONATION_PRESETS = [100, 250, 500, 1000] as const;
export const DONATION_MIN_ZAR = 10;
export const DONATION_MAX_ZAR = 100000;

