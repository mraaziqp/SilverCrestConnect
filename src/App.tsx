/**
 * Application shell.
 *
 * Routing is deliberately tiny — four destinations, no router dependency:
 *   /                  the landing page
 *   /payment/return    PayFast return_url
 *   /payment/cancel    PayFast cancel_url
 *   /admin             the PayFast + applications dashboard
 */

import { useCallback, useEffect, useState } from 'react';

import { Nav } from './components/Nav';
import { Hero } from './components/Hero';
import { About } from './components/About';
import { Programme } from './components/Programme';
import { Tickets } from './components/Tickets';
import { Donate } from './components/Donate';
import { ImpactStand } from './components/ImpactStand';
import { Footer } from './components/Footer';
import { PaymentReturn, PaymentCancelled } from './components/PaymentResult';
import { AdminDashboard } from './admin/AdminDashboard';
import { api } from './lib/api';

interface EventSummary {
  seatsRemaining: number;
  totalRaisedZAR: number;
  supporters: number;
}

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  if (path === '/payment/return') return <PaymentReturn />;
  if (path === '/payment/cancel') return <PaymentCancelled />;
  if (path === '/admin') return <AdminDashboard />;

  return <LandingPage />;
}

function LandingPage() {
  const [summary, setSummary] = useState<EventSummary | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const result = await api<{
        seatsRemaining: number;
        totalRaisedZAR: number;
        supporters: number;
      }>('/api/event');
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
        <Tickets seatsRemaining={summary?.seatsRemaining ?? null} onPaid={loadSummary} />
        <Donate
          totalRaisedZAR={summary?.totalRaisedZAR ?? null}
          supporters={summary?.supporters ?? null}
        />
        <ImpactStand />
      </main>
      <Footer />
    </>
  );
}
