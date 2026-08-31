/**
 * Installable app setup.
 *
 * The site ships two apps from one origin: the public event site, and the
 * dashboard. They are separate installs with their own icons and names, so
 * Wesley gets a "SC Admin" tile that opens straight into the dashboard rather
 * than the public page with a journey to the right screen from there.
 *
 * A browser reads whichever manifest the current document links to, and this is
 * a single-page app served from one index.html — so the link is chosen at
 * runtime from the path, before an install prompt can be considered.
 */

const PUBLIC_MANIFEST = '/manifest.webmanifest';
const ADMIN_MANIFEST = '/admin.webmanifest';

/** True on the dashboard, including a trailing slash or a sub-path. */
function isAdminRoute(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

/** Points the document at the manifest that matches where we are. */
export function applyManifest(pathname: string = window.location.pathname): void {
  const href = isAdminRoute(pathname) ? ADMIN_MANIFEST : PUBLIC_MANIFEST;

  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);

  // The dashboard wears the gold accent so its window furniture is
  // recognisably not the public site.
  const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (theme) theme.content = isAdminRoute(pathname) ? '#C5A059' : '#0A0A0A';
}

/**
 * Registers the worker that makes the site installable.
 *
 * Skipped in development: an install prompt is noise while working, and a
 * worker sitting in front of the dev server only confuses hot reloading.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Installability is a convenience. If registration fails — an
      // unsupported browser, a private window — the site works exactly as
      // before, so there is nothing to tell anyone about.
    });
  });
}
