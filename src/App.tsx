/**
 * Application shell and routing.
 *
 * Routing is deliberately tiny — a handful of destinations, no router
 * dependency:
 *   /                  landing page
 *   /pay/:reference    applicant status + ticket payment (approval emails link here)
 *   /payment/return    PayFast return_url
 *   /payment/cancel    PayFast cancel_url
 *   /admin             PayFast + applications dashboard
 *   anything else      404
 */

import { useCallback, useEffect, useState } from 'react';

import { Nav } from './components/Nav';
import { Hero } from './components/Hero';
import { About } from './components/About';
import { Programme } from './components/Programme';
import { Tickets } from './components/Tickets';
import { Donate } from './components/Donate';
import { Supporters } from './components/Supporters';
import { ImpactStand } from './components/ImpactStand';
import { Footer } from './components/Footer';
import { PaymentReturn, PaymentCancelled } from './components/PaymentResult';
import { ApplicationStatusPage } from './components/ApplicationStatusPage';
import { NotFound } from './components/NotFound';
import { AdminDashboard } from './admin/AdminDashboard';
import { api } from './lib/api';

interface EventSummary {
  seatsRemaining: number;
  totalRaisedZAR: number;
  supporters: number;
}

export default function App() {
  // Strip a trailing slash so /admin and /admin/ resolve the same way.
  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  if (path === '/') return <LandingPage />;
  if (path === '/payment/return') return <PaymentReturn />;
  if (path === '/payment/cancel') return <PaymentCancelled />;
  if (path === '/admin') return <AdminDashboard />;

  const payMatch = path.match(/^\/pay\/([^/]+)$/);
  if (payMatch) {
    return <ApplicationStatusPage reference={decodeURIComponent(payMatch[1])} />;
  }

  return <NotFound />;
}

function LandingPage() {
  const [summary, setSummary] = useState<EventSummary | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const result = await api<EventSummary>('/api/event');
      setSummary({
        seatsRemaining: result.seatsRemaining,
        totalRaisedZAR: result.totalRaisedZAR,
        supporters: result.supporters,
      });
    } catch {
      // Live figures are a nice-to-have. If the API is unreachable the page
      // still renders and sells tickets — the counters just stay hidden.
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return (
    <>
      <Nav />
      <main>
        <Hero seatsRemaining={summary?.seatsRemaining ?? null} />
        <About />
        <Programme />
        <Tickets seatsRemaining={summary?.seatsRemaining ?? null} />
        <Donate
          totalRaisedZAR={summary?.totalRaisedZAR ?? null}
          supporters={summary?.supporters ?? null}
        />
        <Supporters />
        <ImpactStand />
      </main>
      <Footer />
    </>
  );
}
