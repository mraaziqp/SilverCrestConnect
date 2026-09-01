/**
 * Remembers an applicant's reference on their own device.
 *
 * The reference is the only way back to an application: there is deliberately
 * no lookup by email, because that would let anyone type an address and read
 * whether that business applied. So if someone closes the tab without copying
 * the code, and the confirmation email has not arrived, they are stuck with no
 * self-service route at all.
 *
 * Storing it locally closes that gap. It is a convenience, never the source of
 * truth — the server still decides what a reference means, and this only ever
 * offers a link back.
 *
 * Every access is wrapped: localStorage throws outright in some privacy modes,
 * and a browser refusing to remember a code must not break the page that shows
 * it.
 */

const KEY = 'scc26.applications';
const MAX_REMEMBERED = 5;

export interface SavedApplication {
  reference: string;
  businessName?: string;
  /** ISO timestamp of when this device last saw the application. */
  savedAt: string;
}

function read(): SavedApplication[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is SavedApplication =>
          typeof item?.reference === 'string' && item.reference.length > 0,
      )
      .slice(0, MAX_REMEMBERED);
  } catch {
    return [];
  }
}

function write(items: SavedApplication[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX_REMEMBERED)));
  } catch {
    // Storage disabled or full. Remembering is a nicety; carry on without it.
  }
}

/** Everything this device has seen, most recent first. */
export function listSavedApplications(): SavedApplication[] {
  return read().sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''));
}

/**
 * Records a reference, or refreshes one already known.
 *
 * Called both when an application is submitted and when its status page is
 * opened, so a link followed from an email is remembered too.
 */
export function rememberApplication(reference: string, businessName?: string): void {
  const clean = reference.trim().toUpperCase();
  if (!clean) return;

  const existing = read().filter((item) => item.reference.toUpperCase() !== clean);
  write([
    {
      reference: clean,
      // Keep a name already stored if this call does not carry one.
      businessName: businessName ?? read().find((i) => i.reference.toUpperCase() === clean)?.businessName,
      savedAt: new Date().toISOString(),
    },
    ...existing,
  ]);
}

export function forgetApplication(reference: string): void {
  const clean = reference.trim().toUpperCase();
  write(read().filter((item) => item.reference.toUpperCase() !== clean));
}

/** The page an applicant returns to for a given reference. */
export function applicationUrl(reference: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/pay/${encodeURIComponent(reference.trim().toUpperCase())}`;
}
