/**
 * Firestore-backed storage.
 *
 * This is what makes the app safe to run on a serverless host. The JSON
 * driver writes to a local disk, which on Vercel is discarded between
 * requests — an application would vanish after submission, and a PayFast
 * callback could reach a worker holding no record of the payment it is
 * confirming, losing a ticket that has already been paid for.
 *
 * Record reads (applications, payments) always hit Firestore, so any worker
 * sees what every other worker just wrote. Editable content — settings, the
 * programme, list copy — is cached for a few seconds, because it is read on
 * every page load, changes rarely, and being a moment stale is harmless.
 */

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
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

const COLLECTIONS = {
  applications: 'applications',
  payments: 'payments',
  content: 'content',
} as const;

/** Content lives in fixed documents rather than a collection per item. */
const CONTENT_DOCS = {
  settings: 'settings',
  programme: 'programme',
  welcomePack: 'welcomePack',
  impactItems: 'impactItems',
  gallery: 'gallery',
  sponsors: 'sponsors',
  funnelSteps: 'funnelSteps',
} as const;

/** How long editable content may be served from memory before re-reading. */
const CONTENT_TTL_MS = 5_000;

export interface FirestoreConfig {
  projectId?: string;
  /** Path to a service-account JSON file. */
  credentialsPath?: string;
  /** Or the service-account JSON itself, for hosts that only offer env vars. */
  credentialsJson?: string;
}

export function loadFirestoreConfig(env: NodeJS.ProcessEnv = process.env): FirestoreConfig {
  return {
    projectId: (env.FIREBASE_PROJECT_ID || '').trim() || undefined,
    credentialsPath: (env.GOOGLE_APPLICATION_CREDENTIALS || '').trim() || undefined,
    credentialsJson: (env.FIREBASE_SERVICE_ACCOUNT || '').trim() || undefined,
  };
}

/**
 * Builds the admin app.
 *
 * Two credential shapes are supported because hosts differ: a file path works
 * locally, while Render and Vercel are easier to configure by pasting the JSON
 * into a single environment variable.
 */
function initFirebase(config: FirestoreConfig): App {
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
      'Firestore is selected but no credentials were supplied. Set FIREBASE_SERVICE_ACCOUNT to the service-account JSON, or GOOGLE_APPLICATION_CREDENTIALS to a path.',
    );
  }

  return initializeApp({
    credential: cert(serviceAccount as never),
    projectId: config.projectId ?? serviceAccount.project_id,
  });
}

export class FirestoreStore implements DataStore {
  readonly driver = 'firestore' as const;
  /** Firestore is durable wherever it runs — that is the entire point. */
  readonly isPersistent = true;
  readonly storageNote = 'Records are stored in Firestore.';

  private db: Firestore;
  private ready = false;

  /** Short-lived cache for the content documents only. */
  private contentCache = new Map<string, { value: unknown; expiresAt: number }>();

  constructor(config: FirestoreConfig) {
    const app = initFirebase(config);
    this.db = getFirestore(app);
  }

  async init(): Promise<void> {
    if (this.ready) return;

    // Seed the content documents on first run so the dashboard has something
    // to edit. Records themselves start empty and need no seeding.
    await Promise.all([
      this.seed(CONTENT_DOCS.settings, DEFAULT_SETTINGS),
      this.seed(CONTENT_DOCS.programme, { items: DEFAULT_CONTENT.programme }),
      this.seed(CONTENT_DOCS.welcomePack, { items: DEFAULT_CONTENT.welcomePack }),
      this.seed(CONTENT_DOCS.impactItems, { items: DEFAULT_CONTENT.impactItems }),
    ]);

    this.ready = true;
  }

  private async seed(docId: string, value: unknown): Promise<void> {
    const ref = this.db.collection(COLLECTIONS.content).doc(docId);
    const snap = await ref.get();
    if (!snap.exists) await ref.set(value as Record<string, unknown>);
  }

  // ------------------------------------------------------------- content cache

  private async readContent<T>(docId: string, fallback: T): Promise<T> {
    const cached = this.contentCache.get(docId);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;

    const snap = await this.db.collection(COLLECTIONS.content).doc(docId).get();
    const value = (snap.exists ? snap.data() : undefined) as T | undefined;
    const resolved = value ?? fallback;

    this.contentCache.set(docId, { value: resolved, expiresAt: Date.now() + CONTENT_TTL_MS });
    return resolved;
  }

  private async writeContent(docId: string, value: unknown): Promise<void> {
    await this.db.collection(COLLECTIONS.content).doc(docId).set(value as Record<string, unknown>);
    // Drop the cache rather than updating it, so the next read is authoritative.
    this.contentCache.delete(docId);
  }

  // -------------------------------------------------------------- applications

  async listApplications(): Promise<Application[]> {
    const snap = await this.db
      .collection(COLLECTIONS.applications)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((doc) => doc.data() as Application);
  }

  async getApplication(idOrReference: string): Promise<Application | undefined> {
    // The document id is the application id, so try that first — one read.
    const direct = await this.db.collection(COLLECTIONS.applications).doc(idOrReference).get();
    if (direct.exists) return direct.data() as Application;

    const byReference = await this.db
      .collection(COLLECTIONS.applications)
      .where('reference', '==', idOrReference)
      .limit(1)
      .get();
    return byReference.empty ? undefined : (byReference.docs[0].data() as Application);
  }

  async findApplicationByEmail(email: string): Promise<Application | undefined> {
    const snap = await this.db
      .collection(COLLECTIONS.applications)
      .where('email', '==', email.trim().toLowerCase())
      .limit(1)
      .get();
    return snap.empty ? undefined : (snap.docs[0].data() as Application);
  }

  async addApplication(app: Application): Promise<Application> {
    // Emails are matched case-insensitively, so store them folded.
    const record = { ...app, email: app.email.trim().toLowerCase() };
    await this.db.collection(COLLECTIONS.applications).doc(record.id).set(record);
    return record;
  }

  async updateApplication(
    id: string,
    patch: Partial<Application>,
  ): Promise<Application | undefined> {
    const existing = await this.getApplication(id);
    if (!existing) return undefined;

    const updated: Application = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await this.db.collection(COLLECTIONS.applications).doc(existing.id).set(updated);
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
    // Read the paid rows rather than aggregating. A count() sizes the room in
    // businesses and oversells it two-to-one, and a sum('attendeeCount') reads
    // rows written before the second-representative option as zero. Capacity is
    // a room, so this is tens of documents, not thousands.
    const snap = await this.db
      .collection(COLLECTIONS.applications)
      .where('status', '==', 'PAID')
      .get();
    return snap.docs.reduce((seats, doc) => seats + seatsFor(doc.data() as Application), 0);
  }

  // ------------------------------------------------------------------ payments

  async listPayments(): Promise<Payment[]> {
    const snap = await this.db
      .collection(COLLECTIONS.payments)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((doc) => doc.data() as Payment);
  }

  async getPayment(idOrReference: string): Promise<Payment | undefined> {
    const direct = await this.db.collection(COLLECTIONS.payments).doc(idOrReference).get();
    if (direct.exists) return direct.data() as Payment;

    const byReference = await this.db
      .collection(COLLECTIONS.payments)
      .where('reference', '==', idOrReference)
      .limit(1)
      .get();
    return byReference.empty ? undefined : (byReference.docs[0].data() as Payment);
  }

  async addPayment(payment: Payment): Promise<Payment> {
    await this.db.collection(COLLECTIONS.payments).doc(payment.id).set(payment);
    return payment;
  }

  async updatePayment(id: string, patch: Partial<Payment>): Promise<Payment | undefined> {
    const existing = await this.getPayment(id);
    if (!existing) return undefined;

    const updated: Payment = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    // Firestore rejects undefined; strip the keys a patch cleared.
    const clean = Object.fromEntries(
      Object.entries(updated).filter(([, v]) => v !== undefined),
    ) as unknown as Payment;

    await this.db.collection(COLLECTIONS.payments).doc(existing.id).set(clean);
    return clean;
  }

  async completedPayments(): Promise<Payment[]> {
    const snap = await this.db
      .collection(COLLECTIONS.payments)
      .where('status', '==', 'COMPLETE')
      .get();
    return snap.docs.map((doc) => doc.data() as Payment);
  }

  // ---------------------------------------------------------- editable content

  async getSettings(): Promise<EventSettings> {
    const stored = await this.readContent<Partial<EventSettings>>(
      CONTENT_DOCS.settings,
      DEFAULT_SETTINGS,
    );
    // Merged so a settings field added after the document was written still
    // resolves to its default rather than undefined.
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  async updateSettings(patch: Partial<EventSettings>): Promise<EventSettings> {
    const merged = { ...(await this.getSettings()), ...patch };
    await this.writeContent(CONTENT_DOCS.settings, merged);
    return merged;
  }

  async getProgramme(): Promise<ProgrammeItem[]> {
    const doc = await this.readContent<{ items: ProgrammeItem[] }>(CONTENT_DOCS.programme, {
      items: DEFAULT_CONTENT.programme,
    });
    return doc.items ?? [];
  }

  async updateProgramme(items: ProgrammeItem[]): Promise<ProgrammeItem[]> {
    await this.writeContent(CONTENT_DOCS.programme, { items });
    return items;
  }

  async getWelcomePack(): Promise<WelcomePackItem[]> {
    const doc = await this.readContent<{ items: WelcomePackItem[] }>(CONTENT_DOCS.welcomePack, {
      items: DEFAULT_CONTENT.welcomePack,
    });
    return doc.items ?? [];
  }

  async updateWelcomePack(items: WelcomePackItem[]): Promise<WelcomePackItem[]> {
    await this.writeContent(CONTENT_DOCS.welcomePack, { items });
    return items;
  }

  async getImpactItems(): Promise<ImpactItem[]> {
    const doc = await this.readContent<{ items: ImpactItem[] }>(CONTENT_DOCS.impactItems, {
      items: DEFAULT_CONTENT.impactItems,
    });
    return doc.items ?? [];
  }

  async updateImpactItems(items: ImpactItem[]): Promise<ImpactItem[]> {
    await this.writeContent(CONTENT_DOCS.impactItems, { items });
    return items;
  }

  async getGallery(): Promise<GalleryItem[]> {
    const doc = await this.readContent<{ items: GalleryItem[] }>(CONTENT_DOCS.gallery, {
      items: DEFAULT_CONTENT.gallery,
    });
    const items = doc.items;
    return items && items.length > 0 ? items : [...DEFAULT_CONTENT.gallery];
  }

  async updateGallery(items: GalleryItem[]): Promise<GalleryItem[]> {
    await this.writeContent(CONTENT_DOCS.gallery, { items });
    return items;
  }

  async getFunnelSteps(): Promise<FunnelStepItem[]> {
    const doc = await this.readContent<{ items: FunnelStepItem[] }>(CONTENT_DOCS.funnelSteps, {
      items: DEFAULT_CONTENT.funnelSteps,
    });
    return doc.items ?? [];
  }

  async updateFunnelSteps(items: FunnelStepItem[]): Promise<FunnelStepItem[]> {
    await this.writeContent(CONTENT_DOCS.funnelSteps, { items });
    return items;
  }

  async getSponsors(): Promise<Sponsor[]> {
    const doc = await this.readContent<{ items: Sponsor[] }>(CONTENT_DOCS.sponsors, { items: [] });
    return doc.items ?? [];
  }

  async updateSponsors(items: Sponsor[]): Promise<Sponsor[]> {
    await this.writeContent(CONTENT_DOCS.sponsors, { items });
    return items;
  }
}
