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
  presentedBy: 'Silver Crest Consulting',
  hosts: ['Wesley Bosman', 'Saadiqah'],
  /** This event's own site. */
  website: 'https://scconnect.co.za',
  /** The parent consulting business (from the proposal). */
  companyWebsite: 'https://www.silvercrestconsulting.co.za',

  /** 24 October 2026, 09:00 - 13:00 (SAST) */
  date: '2026-10-24',
  dateLabel: '24 October 2026',
  startTime: '09:00',
  endTime: '13:00',
  timeLabel: '09:00 – 13:00',
  timezone: 'Africa/Johannesburg',
  /** ISO instant of the event start, used for the countdown. SAST = UTC+2. */
  startsAtISO: '2026-10-24T09:00:00+02:00',

  city: 'Cape Town',
  venue: 'Venue to be confirmed',
  venueCity: 'Cape Town, South Africa',

  /** Attendance fee per SME, in ZAR. 100% funds the outreach drive. */
  ticketPriceZAR: 350,
  /** The proposal caps the room at 15–20 vetted SMEs. */
  capacityMin: 15,
  capacityMax: 20,
  /** Hard ceiling used by the server to stop overselling. */
  capacity: 20,

  cause: "Silver Crest's Year-End Community Outreach Drive",
  causeShort: 'Year-End Community Outreach Drive',

  contactEmail: 'connect@scconnect.co.za',
  contactPhone: '',

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
  { time: '09:00 – 09:30', duration: '30 mins', title: 'Arrival & Morning Connect', detail: 'Registration, tea/coffee & food stall networking.', kind: 'session' },
  { time: '09:30 – 09:45', duration: '15 mins', title: 'Keynote Speaker #1', detail: 'Topic to be confirmed.', kind: 'keynote' },
  { time: '09:45 – 10:30', duration: '45 mins', title: 'SME Spotlight — Round 1', detail: 'Elevator speeches, max 2 minutes per SME.', kind: 'spotlight' },
  { time: '10:30 – 10:45', duration: '15 mins', title: 'Keynote Speaker #2', detail: 'Topic to be confirmed.', kind: 'keynote' },
  { time: '10:45 – 11:30', duration: '45 mins', title: 'SME Spotlight — Round 2', detail: 'Floor browsing & vendor stall visits.', kind: 'spotlight' },
  { time: '11:30 – 11:45', duration: '15 mins', title: 'Keynote Speaker #3', detail: 'Topic to be confirmed.', kind: 'keynote' },
  { time: '11:45 – 12:30', duration: '45 mins', title: 'Open Floor Networking', detail: 'Open networking & food stall experience.', kind: 'session' },
  { time: '12:30 – 12:45', duration: '15 mins', title: 'Keynote Speaker #4', detail: 'Topic to be confirmed.', kind: 'keynote' },
  { time: '12:45 – 13:00', duration: '15 mins', title: 'Closing Remarks', detail: `${EVENT.causeShort} official announcement.`, kind: 'session' },
] as const;

/** The three-step vetting funnel (proposal, section 04). */
export const FUNNEL_STEPS = [
  { step: '01', title: 'Application Form', body: 'Business owners submit a concise online application with company details and industry sector.' },
  { step: '02', title: 'Verification Check', body: 'The Silver Crest team runs a quick CIPC / digital footprint review to confirm active SME status and maintain exclusivity.' },
  { step: '03', title: 'Approval & Ticket', body: `Approved SMEs receive a secure payment link to finalise the R${EVENT.ticketPriceZAR} fee, followed by their official digital event ticket.` },
] as const;

/** On-site activation (proposal, section 05) — shown on the landing page as proof of impact. */
export const IMPACT_ITEMS = [
  { title: 'Past Outreach Exhibition', body: "A poster board showcase displaying photos and impact metrics from Silver Crest's last community drive." },
  { title: 'On-The-Day Contribution Jar', body: 'A branded, secure collection container at the Silver Crest stand for cash contributions throughout the morning.' },
  { title: 'Instant QR Contributions', body: 'Scan-to-give displayed on the stand poster for seamless digital card contributions.' },
  { title: 'Food & Drink Vendors', body: 'Local food stalls and a dedicated coffee/tea vendor keeping energy high across the 4-hour schedule.' },
] as const;

/** What every registered SME receives (proposal, section 06). */
export const WELCOME_PACK = [
  { title: 'Custom Lanyard & Business Tag', body: 'Branded Silver Crest Connect lanyard with a custom badge showing business name and founder details.' },
  { title: 'Executive Branded Pen', body: 'Sleek metallic executive pen custom-engraved with the Silver Crest Connect branding.' },
] as const;

/** Preset donation amounts in ZAR offered on the Donate card. */
export const DONATION_PRESETS = [100, 250, 500, 1000] as const;
export const DONATION_MIN_ZAR = 10;
export const DONATION_MAX_ZAR = 100000;
