/**
 * Single source of truth for all Silver Crest Connect '26 event facts.
 * Everything user-facing reads from here so copy never drifts between
 * the landing page, the emails, the admin dashboard and the API.
 *
 * Source: "Silvercrest_Connect_Proposal_v4.pdf" (Event Proposal & Concept Note).
 */

import type { Sponsor, SponsorPlacement } from '../types';

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
    'An exclusive half-day business-to-business networking showcase for local SME founders, where business growth directly supports community outreach.',
  aboutTitle: 'A room built for real business, funding real community work.',
  aboutLead:
    'Silver Crest Connect brings together local business founders for focused business-to-business networking. A portion of every ticket sold funds our Year-End Community Outreach Drive.',
  aboutBody:
    'Curated introductions between founders, practical keynote sessions, and a dedicated SME Spotlight where each business owner has the floor to present their services.',

  /** Attendance fee per SME (primary representative), in ZAR. A portion funds the outreach drive. */
  ticketPriceZAR: 450,
  /** Additional fee in ZAR for a second representative / employee / co-worker. */
  additionalRepPriceZAR: 350,
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
    'A portion of the proceeds from tickets and donations goes towards supplies for the Year-End Community Outreach Drive.',
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
    body: `Gathering ${EVENT.capacityMin}–${EVENT.capacityMax} selected local SME owners for curated, high-intent business-to-business networking and collaboration in a structured environment.`,
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
    body: `A portion of attendance proceeds (R${EVENT.ticketPriceZAR} per SME) funds ${EVENT.cause}.`,
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

/**
 * The public join funnel — the numbered steps to a seat.
 *
 * These seed an empty store; from then on they are edited in /admin like any
 * other content, so the wording here is a starting point rather than the truth.
 * Numbering is derived from position, so a step can be added or removed without
 * leaving the sequence wrong.
 *
 * Deliberately no price in step three. It used to interpolate the ticket fee,
 * which meant an editor could not change that sentence without the amount
 * reappearing, and the amount is already stated plainly on the ticket card.
 */
export const FUNNEL_STEPS: ReadonlyArray<{ id: string; title: string; body: string }> = [
  {
    id: 'step-1',
    title: 'Application & Sector Submission',
    body: 'Submit your business details and industry category. Attendance is strictly limited to 1 to 2 businesses per category to prevent oversaturation.',
  },
  {
    id: 'step-2',
    title: 'Review & Category Approval',
    body: 'The Silver Crest team reviews your application to ensure industry fit and slot availability for your sector.',
  },
  {
    id: 'step-3',
    title: 'Payment Link & Spot Confirmation',
    body: 'Approved businesses receive an exclusive payment link to complete the attendance fee and lock in their official event ticket.',
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
  { id: 'wp-2', title: 'Executive Branded Pen', body: 'Sleek metallic executive pen custom-engraved with the Silver Crest Connect branding.' },
];

/**
 * The sponsor rails, in page order.
 *
 * Every entry here has a matching <SponsorRail> in the layout. Adding a value
 * without adding the rail would offer a placement in the dashboard that
 * silently shows nothing, so the two are meant to be changed together.
 */
export const SPONSOR_PLACEMENTS: ReadonlyArray<{ value: SponsorPlacement; label: string; hint: string }> = [
  { value: 'hero', label: 'Under the hero', hint: 'First thing visitors see, directly below the headline.' },
  { value: 'about', label: 'After the about section', hint: 'Following the event description.' },
  { value: 'how-to-join', label: 'After the join steps', hint: 'Below the numbered steps to a seat.' },
  { value: 'tickets', label: 'After attendance', hint: 'Below the ticket card and FAQs.' },
  { value: 'donate', label: 'Bottom of the donation section', hint: 'Under the donation form and drive photos.' },
  { value: 'impact', label: 'After the impact stand', hint: 'Below the on-the-day activation.' },
  { value: 'footer', label: 'Above the footer', hint: 'Last band before the footer.' },
];

/** No sponsors until some are added in the dashboard. */
export const DEFAULT_SPONSORS: Sponsor[] = [];

/** Default photos from the previous outreach drive shown beside the donation form. */
export const DEFAULT_GALLERY = [
  {
    id: 'photo-1',
    url: '/outreach/drive-pack-1.webp',
    caption: 'Personal care and hygiene kits prepared for community distribution.',
  },
  {
    id: 'photo-2',
    url: '/outreach/drive-pack-2.webp',
    caption: 'Winter warmth packages, knitted beanies, and daily toiletries.',
  },
  {
    id: 'photo-3',
    url: '/outreach/drive-pack-3.webp',
    caption: 'Pantry staples, soup mixes, canned foods, and nutrition parcels.',
  },
  {
    id: 'photo-4',
    url: '/outreach/drive-pack-4.webp',
    caption: 'Complete outreach care parcel with blankets, food supplies, and toiletries.',
  },
];

/** Preset donation amounts in ZAR offered on the Donate card. */
export const DONATION_PRESETS = [100, 250, 500, 1000] as const;
export const DONATION_MIN_ZAR = 10;
export const DONATION_MAX_ZAR = 100000;

/** Curated industry sectors (aiming for 1-2 businesses per category). */
export const INDUSTRY_CATEGORIES = [
  'Accounting & Financial Services',
  'Legal Services & Compliance',
  'Technology, Software & IT',
  'Marketing, Media & Design',
  'Real Estate & Property Management',
  'Construction, Trades & Engineering',
  'Retail, Wholesale & eCommerce',
  'Healthcare, Medical & Wellness',
  'Hospitality, Events & Catering',
  'Consulting, Coaching & HR',
  'Logistics, Transport & Supply Chain',
  'Manufacturing & Industrial',
  'Education & Training',
  'Other / Specialized Services',
] as const;

/** Items included in the attendance fee. */
export const TICKET_INCLUDES = [
  'Silver Crest Connect 2026 full session access',
  'Light breakfast and morning refreshments included',
  'Expert keynote discussions and practical founder Q&A',
  'Dedicated SME Spotlight presentation for your business',
  'Curated business-to-business networking with 1-2 businesses per category',
  'Welcome pack with executive branded pen',
];

/**
 * Frequently Asked Questions.
 *
 * A function, not a constant, because the first answer quotes prices and both
 * of those are editable in /admin. Frozen at build time it would keep quoting
 * the old figure after a price change — on the one part of the page people
 * read specifically to find out what they will be charged.
 */
export function buildFaqs(primaryFeeZAR: number, additionalRepFeeZAR: number) {
  const rand = (amount: number) => `R${Math.round(amount)}`;

  return [
    {
      question: 'Can I bring someone from my business?',
      answer:
        `Yes. Each business may apply for up to two representatives. The primary applicant is ` +
        `charged ${rand(primaryFeeZAR)}, and a second representative is ${rand(additionalRepFeeZAR)} ` +
        `more — ${rand(primaryFeeZAR + additionalRepFeeZAR)} in total. Both include the light ` +
        `breakfast, materials, and full event access.`,
    },
    {
      question: 'How does the curated application process work?',
      answer:
        'To ensure a high-value, diverse room without oversaturation, we curate 1 to 2 businesses per industry category. Step 1: Submit your free application. Step 2: Our team reviews your category fit. Step 3: Once approved, you receive your private payment link to book and confirm your seat.',
    },
    {
      question: 'When is payment required?',
      answer:
        'Applying is completely free. Payment is only requested after your application has been reviewed and approved by the Silver Crest team.',
    },
    {
      question: 'What happens if my industry category is full?',
      answer:
        'If your category has reached its limit, our team reviews whether your specific services offer a distinct niche. If suitable, we may approve your spot or place you on the priority waiting list.',
    },
  ];
}

/** Default-priced FAQs, for anywhere without live settings to hand. */
export const FAQS = buildFaqs(EVENT.ticketPriceZAR, EVENT.additionalRepPriceZAR);

