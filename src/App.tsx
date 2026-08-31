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

import { Suspense, lazy, useCallback, useEffect, useState } from 'react';

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

/**
 * The dashboard is loaded on demand.
 *
 * It is by far the largest thing in the app and only Wesley ever opens it, so
 * bundling it statically made every visitor download the whole admin surface
 * before they could read the front page — on a South African mobile
 * connection, for a page they will never see.
 */
const AdminDashboard = lazy(() =>
  import('./admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })),
);
import { api } from './lib/api';
import type { GalleryItem } from './types';
import type { EventSettings, WelcomePackItem, ImpactItem, Sponsor, FunnelStepItem } from './types';
import { SponsorRail } from './components/SponsorRail';
import { Monogram } from './components/Brand';

interface EventSummary {
  gallery?: GalleryItem[];
  seatsRemaining: number;
  totalRaisedZAR: number;
  supporters: number;
  event?: EventSettings;
  welcomePack?: WelcomePackItem[];
  impactItems?: ImpactItem[];
  sponsors?: Sponsor[];
  funnelSteps?: FunnelStepItem[];
  paymentsOpen?: boolean;
}

export default function App() {
  // Strip a trailing slash so /admin and /admin/ resolve the same way.
  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  if (path === '/') return <LandingPage />;
  if (path === '/payment/return') return <PaymentReturn />;
  if (path === '/payment/cancel') return <PaymentCancelled />;
  if (path === '/admin') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-ink" aria-busy="true" />}>
        <AdminDashboard />
      </Suspense>
    );
  }

  const payMatch = path.match(/^\/pay\/([^/]+)$/);
  if (payMatch) {
    return <ApplicationStatusPage reference={decodeURIComponent(payMatch[1])} />;
  }

  return <NotFound />;
}

function LandingPage() {
  const [summary, setSummary] = useState<EventSummary | null>(null);
  /**
   * Whether the first load has finished, one way or another.
   *
   * Almost every string on this page has a code default and a stored value that
   * the client edits in /admin. Rendering before the fetch returns shows the
   * default, and the stored value then replaces it a moment later — the page
   * visibly changes its own wording seconds after loading, which reads as a
   * fault rather than as loading. Holding the first paint until the answer is
   * in removes the swap everywhere at once, instead of a placeholder per field.
   */
  const [settled, setSettled] = useState(false);

  const sponsorHeading = summary?.event?.sponsorsHeading ?? 'In partnership with';

  const loadSummary = useCallback(async () => {
    try {
      const result = await api<EventSummary>('/api/event');
      setSummary(result);
    } catch {
      // Live figures are a nice-to-have. If the API is unreachable the page
      // still renders — default config takes over.
      setSummary(null);
    } finally {
      setSettled(true);
    }
  }, []);

  useEffect(() => {
    loadSummary();

    // A safety net, not the normal path: the request is same-origin and
    // answers in milliseconds. If the API is slow or dead the page must still
    // appear, on the defaults, rather than hold on a blank screen.
    const failsafe = window.setTimeout(() => setSettled(true), 2500);
    return () => window.clearTimeout(failsafe);
  }, [loadSummary]);

  if (!settled) {
    return (
      <div
        className="min-h-screen bg-ink flex items-center justify-center"
        role="status"
        aria-label="Loading"
      >
        <span className="sr-only">Loading</span>
        <Monogram size={54} />
      </div>
    );
  }

  return (
    <>
      <Nav event={summary?.event} />
      <main>
        <Hero
          seatsRemaining={summary?.seatsRemaining ?? null}
          event={summary?.event}
        />
        <SponsorRail sponsors={summary?.sponsors} placement="hero" heading={sponsorHeading} />
        <About event={summary?.event} />
        <SponsorRail sponsors={summary?.sponsors} placement="about" heading={sponsorHeading} />
        <Programme welcomePack={summary?.welcomePack} funnelSteps={summary?.funnelSteps} />
        <SponsorRail sponsors={summary?.sponsors} placement="how-to-join" heading={sponsorHeading} />
        <Tickets
          seatsRemaining={summary?.seatsRemaining ?? null}
          event={summary?.event}
        />
        <SponsorRail sponsors={summary?.sponsors} placement="tickets" heading={sponsorHeading} />
        <Donate
          totalRaisedZAR={summary?.totalRaisedZAR ?? null}
          supporters={summary?.supporters ?? null}
          gallery={summary?.gallery}
          galleryHeading={summary?.event?.galleryHeading}
          galleryBody={summary?.event?.galleryBody}
          paymentsOpen={summary?.paymentsOpen !== false}
          event={summary?.event}
        />
        <SponsorRail sponsors={summary?.sponsors} placement="donate" heading={sponsorHeading} />
        <Supporters />
        <ImpactStand
          impactItems={summary?.impactItems}
          event={summary?.event}
        />
        <SponsorRail sponsors={summary?.sponsors} placement="impact" heading={sponsorHeading} />
        <SponsorRail sponsors={summary?.sponsors} placement="footer" heading={sponsorHeading} />
      </main>
      <Footer event={summary?.event} />
    </>
  );
}
