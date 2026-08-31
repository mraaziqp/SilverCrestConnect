/**
 * Firebase Realtime Database storage.
 *
 * Same contract as the Firestore driver — this exists because Realtime
 * Database is what the project actually has. Either is fine at this scale;
 * the app picks whichever is configured.
 *
 * As with Firestore, record reads go to the server rather than a local cache,
 * so a PayFast callback landing on a fresh serverless worker still finds the
 * payment it is confirming. Editable content is cached briefly, since it is
 * read on every page load and changes rarely.
 */

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getDatabase, type Database as RtdbDatabase } from 'firebase-admin/database';
import { readFileSync } from 'fs';

import { seatsFor } from './store-types.js';

import type {
  Application,
  ApplicationStatus,
  EventSettings,
  ImpactItem,
  Payment,
  ProgrammeItem,
  WelcomePackItem,
  GalleryItem,
  Sponsor,
  FunnelStepItem,
} from '../types.js';
import type { DataStore } from './store-types.js';
import { DEFAULT_SETTINGS, DEFAULT_CONTENT } from './store.js';

const PATHS = {
  applications: 'applications',
  payments: 'payments',
  content: 'content',
} as const;

const CONTENT_TTL_MS = 5_000;

/** A write that has not answered by now is not going to. */
const WRITE_TIMEOUT_MS = 12_000;

export interface RtdbConfig {
  databaseUrl: string;
  projectId?: string;
  credentialsPath?: string;
  credentialsJson?: string;
}

export function loadRtdbConfig(env: NodeJS.ProcessEnv = process.env): RtdbConfig {
  return {
    databaseUrl: (env.FIREBASE_DATABASE_URL || '').trim(),
    projectId: (env.FIREBASE_PROJECT_ID || '').trim() || undefined,
    credentialsPath: (env.GOOGLE_APPLICATION_CREDENTIALS || '').trim() || undefined,
    credentialsJson: (env.FIREBASE_SERVICE_ACCOUNT || '').trim() || undefined,
  };
}

function initFirebase(config: RtdbConfig): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  let serviceAccount: Record<string, string> | undefined;
  if (config.credentialsJson) {
    serviceAccount = JSON.parse(config.credentialsJson);
  } else if (config.credentialsPath) {
    serviceAccount = JSON.parse(readFileSync(config.credentialsPath, 'utf8'));
  }

  if (!serviceAccount) {
    throw new Error(
      'Realtime Database is selected but no credentials were supplied. Set FIREBASE_SERVICE_ACCOUNT to the service-account JSON, or GOOGLE_APPLICATION_CREDENTIALS to a path.',
    );
  }

  return initializeApp({
    credential: cert(serviceAccount as never),
    projectId: config.projectId ?? serviceAccount.project_id,
    databaseURL: config.databaseUrl,
  });
}

/**
 * Realtime Database silently discards keys whose value is undefined in some
 * paths and throws in others, so strip them before every write.
 */
function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;
}

export class RtdbStore implements DataStore {
  readonly driver = 'rtdb' as const;
  readonly isPersistent = true;
  readonly storageNote = 'Records are stored in Firebase Realtime Database.';

  private db: RtdbDatabase;
  private app: App;
  private baseUrl: string;
  private ready = false;
  private contentCache = new Map<string, { value: unknown; expiresAt: number }>();

  constructor(config: RtdbConfig) {
    if (!config.databaseUrl) {
      throw new Error('FIREBASE_DATABASE_URL is required for the Realtime Database driver.');
    }
    this.app = initFirebase(config);
    this.db = getDatabase(this.app);
    this.baseUrl = config.databaseUrl.replace(/\/+$/, '');
  }

  /**
   * Writes a value over the database's REST interface.
   *
   * The SDK writes over a long-lived WebSocket, and set() resolves only once
   * the server acknowledges across it. That is fine in a process that stays
   * alive; it is a trap on a serverless platform, where a container is frozen
   * between requests and thawed later holding a socket the SDK still believes
   * is open. The write is then queued against a connection that can never
   * acknowledge, the promise never settles, and the request dies at the
   * platform's limit — surfacing as a 504 with nothing to explain it, which is
   * exactly what saving a photo to the gallery was doing.
   *
   * REST has no such state. Each write is one HTTPS request that either
   * answers or times out, and a timeout here says so instead of hanging.
   */
  private async restPut(path: string, value: unknown): Promise<void> {
    const { access_token: accessToken } = await this.app.options.credential!.getAccessToken();

    const response = await fetch(`${this.baseUrl}/${path}.json?access_token=${accessToken}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value ?? null),
      signal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Database write to ${path} failed (${response.status}). ${detail.slice(0, 200)}`.trim(),
      );
    }
  }

  async init(): Promise<void> {
    if (this.ready) return;

    await Promise.all([
      this.seed('settings', DEFAULT_SETTINGS),
      this.seed('programme', { items: DEFAULT_CONTENT.programme }),
      this.seed('welcomePack', { items: DEFAULT_CONTENT.welcomePack }),
      this.seed('impactItems', { items: DEFAULT_CONTENT.impactItems }),
    ]);

    this.ready = true;
  }

  private async seed(key: string, value: unknown): Promise<void> {
    const ref = this.db.ref(`${PATHS.content}/${key}`);
    const snap = await ref.get();
    if (!snap.exists()) await this.restPut(`${PATHS.content}/${key}`, stripUndefined(value as object));
  }

  // ------------------------------------------------------------- content cache

  private async readContent<T>(key: string, fallback: T): Promise<T> {
    const cached = this.contentCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;

    const snap = await this.db.ref(`${PATHS.content}/${key}`).get();
    const resolved = (snap.exists() ? (snap.val() as T) : undefined) ?? fallback;

    this.contentCache.set(key, { value: resolved, expiresAt: Date.now() + CONTENT_TTL_MS });
    return resolved;
  }

  private async writeContent(key: string, value: unknown): Promise<void> {
    await this.restPut(`${PATHS.content}/${key}`, stripUndefined(value as object));
    this.contentCache.delete(key);
  }

  /**
   * Runs an indexed query, falling back to a full scan when the matching
   * `.indexOn` rule has not been added.
   *
   * Realtime Database refuses an orderByChild query without an index. The
   * rules in firebase-rules/database.rules.json add them, but the app should
   * not break before they are deployed — at this size a scan is milliseconds.
   */
  private async queryByChild<T>(
    path: string,
    field: string,
    value: string,
  ): Promise<T[]> {
    try {
      const snap = await this.db.ref(path).orderByChild(field).equalTo(value).get();
      if (!snap.exists()) return [];
      return Object.values(snap.val() as Record<string, T>);
    } catch (err) {
      if (!/Index not defined/i.test(String((err as Error)?.message))) throw err;

      const all = await this.readAll<T>(path);
      return all.filter((item) => (item as Record<string, unknown>)[field] === value);
    }
  }

  /** Realtime Database stores collections as objects keyed by id. */
  private async readAll<T>(path: string): Promise<T[]> {
    const snap = await this.db.ref(path).get();
    if (!snap.exists()) return [];
    const value = snap.val() as Record<string, T> | null;
    return value ? Object.values(value) : [];
  }

  // -------------------------------------------------------------- applications

  async listApplications(): Promise<Application[]> {
    const all = await this.readAll<Application>(PATHS.applications);
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getApplication(idOrReference: string): Promise<Application | undefined> {
    // The key is the application id, so try a direct read first.
    const direct = await this.db.ref(`${PATHS.applications}/${idOrReference}`).get();
    if (direct.exists()) return direct.val() as Application;

    const matches = await this.queryByChild<Application>(
      PATHS.applications,
      'reference',
      idOrReference,
    );
    return matches[0];
  }

  async findApplicationByEmail(email: string): Promise<Application | undefined> {
    const matches = await this.queryByChild<Application>(
      PATHS.applications,
      'email',
      email.trim().toLowerCase(),
    );
    return matches[0];
  }

  async addApplication(app: Application): Promise<Application> {
    const record = stripUndefined({ ...app, email: app.email.trim().toLowerCase() });
    await this.restPut(`${PATHS.applications}/${record.id}`, record);
    return record;
  }

  async updateApplication(
    id: string,
    patch: Partial<Application>,
  ): Promise<Application | undefined> {
    const existing = await this.getApplication(id);
    if (!existing) return undefined;

    const updated = stripUndefined({
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    await this.restPut(`${PATHS.applications}/${existing.id}`, updated);
    return updated;
  }

  async countApplicationsByStatus(): Promise<Record<ApplicationStatus, number>> {
    const counts: Record<ApplicationStatus, number> = {
      PENDING_REVIEW: 0,
      APPROVED: 0,
      PAID: 0,
      REJECTED: 0,
      WAITLISTED: 0,
    };
    for (const app of await this.listApplications()) {
      counts[app.status] = (counts[app.status] ?? 0) + 1;
    }
    return counts;
  }

  async countPaidSeats(): Promise<number> {
    const paid = await this.queryByChild<Application>(PATHS.applications, 'status', 'PAID');
    return paid.reduce((seats, a) => seats + seatsFor(a), 0);
  }

  // ------------------------------------------------------------------ payments

  async listPayments(): Promise<Payment[]> {
    const all = await this.readAll<Payment>(PATHS.payments);
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getPayment(idOrReference: string): Promise<Payment | undefined> {
    const direct = await this.db.ref(`${PATHS.payments}/${idOrReference}`).get();
    if (direct.exists()) return direct.val() as Payment;

    const matches = await this.queryByChild<Payment>(PATHS.payments, 'reference', idOrReference);
    return matches[0];
  }

  async addPayment(payment: Payment): Promise<Payment> {
    const record = stripUndefined(payment);
    await this.restPut(`${PATHS.payments}/${record.id}`, record);
    return record;
  }

  async updatePayment(id: string, patch: Partial<Payment>): Promise<Payment | undefined> {
    const existing = await this.getPayment(id);
    if (!existing) return undefined;

    const updated = stripUndefined({
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    await this.restPut(`${PATHS.payments}/${existing.id}`, updated);
    return updated;
  }

  async completedPayments(): Promise<Payment[]> {
    return this.queryByChild<Payment>(PATHS.payments, 'status', 'COMPLETE');
  }

  // ---------------------------------------------------------- editable content

  async getSettings(): Promise<EventSettings> {
    const stored = await this.readContent<Partial<EventSettings>>('settings', DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  async updateSettings(patch: Partial<EventSettings>): Promise<EventSettings> {
    const merged = { ...(await this.getSettings()), ...patch };
    await this.writeContent('settings', merged);
    return merged;
  }

  async getProgramme(): Promise<ProgrammeItem[]> {
    const doc = await this.readContent<{ items: ProgrammeItem[] }>('programme', {
      items: DEFAULT_CONTENT.programme,
    });
    return doc.items ?? [];
  }

  async updateProgramme(items: ProgrammeItem[]): Promise<ProgrammeItem[]> {
    await this.writeContent('programme', { items });
    return items;
  }

  async getWelcomePack(): Promise<WelcomePackItem[]> {
    const doc = await this.readContent<{ items: WelcomePackItem[] }>('welcomePack', {
      items: DEFAULT_CONTENT.welcomePack,
    });
    return doc.items ?? [];
  }

  async updateWelcomePack(items: WelcomePackItem[]): Promise<WelcomePackItem[]> {
    await this.writeContent('welcomePack', { items });
    return items;
  }

  async getImpactItems(): Promise<ImpactItem[]> {
    const doc = await this.readContent<{ items: ImpactItem[] }>('impactItems', {
      items: DEFAULT_CONTENT.impactItems,
    });
    return doc.items ?? [];
  }

  async updateImpactItems(items: ImpactItem[]): Promise<ImpactItem[]> {
    await this.writeContent('impactItems', { items });
    return items;
  }

  async getGallery(): Promise<GalleryItem[]> {
    const doc = await this.readContent<{ items: GalleryItem[] }>('gallery', { items: [] });
    return doc.items ?? [];
  }

  async updateGallery(items: GalleryItem[]): Promise<GalleryItem[]> {
    await this.writeContent('gallery', { items });
    return items;
  }

  async getFunnelSteps(): Promise<FunnelStepItem[]> {
    const doc = await this.readContent<{ items: FunnelStepItem[] }>('funnelSteps', {
      items: DEFAULT_CONTENT.funnelSteps,
    });
    return doc.items ?? [];
  }

  async updateFunnelSteps(items: FunnelStepItem[]): Promise<FunnelStepItem[]> {
    await this.writeContent('funnelSteps', { items });
    return items;
  }

  async getSponsors(): Promise<Sponsor[]> {
    const doc = await this.readContent<{ items: Sponsor[] }>('sponsors', { items: [] });
    return doc.items ?? [];
  }

  async updateSponsors(items: Sponsor[]): Promise<Sponsor[]> {
    await this.writeContent('sponsors', { items });
    return items;
  }
}
