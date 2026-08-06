# Silver Crest Connect

**Premium Exhibition Booking & B2B Networking Platform**

Presented by **Silver Crest Consulting**

> *"Building Business. Strengthening Community."*

---

## Overview

Silver Crest Connect is a full-featured exhibition management platform for the **Silver Crest Connect Annual Business Summit & Exhibition** (October 14–16, 2026). It provides:

- **Interactive Floor Plan Engine** — Browse halls (VIP Atrium, Hall A, Hall B), select booths, and hold reservations with a 10-minute lock
- **Stall Booking & Checkout** — Complete exhibitor registration with tiered pricing, add-on packages, and deposit/full payment options
- **Exhibitor Directory** — Browse confirmed exhibitors with Verified trust badges
- **Attendee Networking Hub** — B2B matchmaking, digital business card swaps, 1-on-1 chat, and coffee meeting scheduling
- **Event Agenda & Keynotes** — Full 3-day agenda with session tracks, speakers, and room assignments
- **Digital Passes & Receipts** — QR-coded entry badges and downloadable invoice records
- **Database Schema & API Inspector** — Reference architecture with Prisma schema and live API route tester

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite
- **UI**: Lucide React icons, Motion (Framer Motion)
- **Backend** (local dev): Express.js with in-memory data stores
- **Deployment**: Vercel (static SPA)

## Getting Started

```bash
# Install dependencies
npm install

# Start development server (with Express API backend)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

This project is configured for **Vercel** deployment:

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Vercel auto-detects Vite and deploys

The `vercel.json` handles SPA routing with client-side fallback.

## Project Structure

```
├── index.html              # Entry HTML
├── vercel.json             # Vercel deployment config
├── vite.config.ts          # Vite configuration
├── server.ts               # Express dev server (local only)
├── src/
│   ├── App.tsx             # Root component
│   ├── main.tsx            # React entry point
│   ├── index.css           # Tailwind imports
│   ├── types.ts            # TypeScript type definitions
│   ├── components/
│   │   ├── StallBookingDashboard.tsx
│   │   ├── Header.tsx
│   │   ├── FloorPlan.tsx
│   │   ├── StallSummaryCard.tsx
│   │   ├── CheckoutModal.tsx
│   │   ├── MyBookings.tsx
│   │   ├── ExhibitorDirectory.tsx
│   │   ├── AgendaDashboard.tsx
│   │   ├── AttendeeNetworkingHub.tsx
│   │   ├── SchemaInspector.tsx
│   │   └── VerifiedBadgeModal.tsx
│   └── data/
│       ├── mockData.ts     # Demo data for all entities
│       └── prismaSchema.ts # Reference database schema
└── package.json
```

## License

Proprietary — Silver Crest Consulting. All rights reserved.
