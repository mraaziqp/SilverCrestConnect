/**
 * Persistence for applications and payments.
 *
 * The original build kept everything in module-level arrays, so a restart
 * silently discarded every booking. This store writes through to a JSON file
 * so records survive a restart on any normal Node host.
 *
 * Writes are serialised through a promise chain and go via a temp file +
 * rename, so a crash mid-write cannot truncate the database.
 *
 * On a read-only or ephemeral filesystem (Vercel/Lambda) the file driver
 * degrades to memory-only and says so loudly — payment records would not
 * survive, which is why the README calls for a real database there.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { DataStore } from './store-types.js';
import { seatsFor } from './store-types.js';
import type {
  Application,
  ApplicationStatus,
  Payment,
  EventSettings,
  ProgrammeItem,
  WelcomePackItem,
  ImpactItem,
  GalleryItem,
  Sponsor,
  FunnelStepItem,
} from '../types.js';
import {
  EVENT,
  PROGRAMME as DEFAULT_PROGRAMME,
  WELCOME_PACK as DEFAULT_WELCOME_PACK,
  IMPACT_ITEMS as DEFAULT_IMPACT_ITEMS,
  DEFAULT_GALLERY,
  FUNNEL_STEPS as DEFAULT_FUNNEL_STEPS,
} from '../config/event.js';

export const DEFAULT_SETTINGS: EventSettings = {
  name: EVENT.name,
  edition: EVENT.edition,
  fullName: EVENT.fullName,
  tagline: EVENT.tagline,
  presentedBy: EVENT.presentedBy,
  companyName: EVENT.companyName,
  companyWebsite: EVENT.companyWebsite,
  website: EVENT.website,
  contactEmail: EVENT.contactEmail,
  contactPhone: EVENT.contactPhone,
  date: EVENT.date,
  dateLabel: EVENT.dateLabel,
  startTime: EVENT.startTime,
  endTime: EVENT.endTime,
  timeLabel: EVENT.timeLabel,
  timezone: EVENT.timezone,
  startsAtISO: EVENT.startsAtISO,
  city: EVENT.city,
  venue: EVENT.venue,
  venueCity: EVENT.venueCity,
  heroParagraph: EVENT.heroParagraph,
  aboutTitle: EVENT.aboutTitle,
  aboutLead: EVENT.aboutLead,
  aboutBody: EVENT.aboutBody,
  ticketPriceZAR: EVENT.ticketPriceZAR,
  additionalRepPriceZAR: EVENT.additionalRepPriceZAR,
  capacityMin: EVENT.capacityMin,
  capacityMax: EVENT.capacityMax,
  capacity: EVENT.capacity,
  cause: EVENT.cause,
  causeShort: EVENT.causeShort,
  footerNote: EVENT.footerNote,
  copyrightText: EVENT.copyrightText,
  galleryHeading: 'Our last outreach drive',
  sponsorsHeading: 'In partnership with',
  galleryBody:
    'Every rand raised here goes towards supplies for the next drive. These are photographs from the last one.',
  donateHeading: 'Fund the {cause}',
  donateLead:
    'You do not have to attend to make an impact. 100% of every donation goes towards supplies for the {cause}.',
  impactFundingNote:
    '100% of every donation goes towards supplies for the {cause}.',
  sponsorsEnabled: true,
};

interface Database {
  applications: Application[];
  payments: Payment[];
  settings: EventSettings;
  programme: ProgrammeItem[];
  welcomePack: WelcomePackItem[];
  impactItems: ImpactItem[];
  gallery: GalleryItem[];
  /** Optional: absent in files written before these existed. */
  sponsors?: Sponsor[];
  funnelSteps?: FunnelStepItem[];
}

/**
 * A fresh database with the built-in defaults.
 *
 * A function rather than a shared constant: the defaults contain arrays and
 * objects, and a single shared instance would let one Store mutate the
 * defaults out from under the next one.
 */
/**
 * Keeps only the keys the current EventSettings shape declares.
 *
 * Starting from the defaults guarantees every field is present, so the result
 * really is a complete EventSettings rather than a partial one wearing a cast.
 */
function pruneSettings(merged: Record<string, unknown>, defaults: EventSettings): EventSettings {
  const out = { ...defaults } as Record<string, unknown>;
  for (const key of Object.keys(defaults)) {
    if (key in merged) out[key] = merged[key];
  }
  return out as unknown as EventSettings;
}

/** Default editable content, shared with the Firestore driver for seeding. */
export const DEFAULT_CONTENT = {
  programme: DEFAULT_PROGRAMME as unknown as ProgrammeItem[],
  welcomePack: DEFAULT_WELCOME_PACK as unknown as WelcomePackItem[],
  impactItems: DEFAULT_IMPACT_ITEMS as unknown as ImpactItem[],
  funnelSteps: DEFAULT_FUNNEL_STEPS as unknown as FunnelStepItem[],
  gallery: DEFAULT_GALLERY as unknown as GalleryItem[],
};

function emptyDatabase(): Database {
  return {
    applications: [],
    payments: [],
    settings: { ...DEFAULT_SETTINGS },
    programme: DEFAULT_PROGRAMME.map((item) => ({ ...item })),
    welcomePack: DEFAULT_WELCOME_PACK.map((item) => ({ ...item })),
    impactItems: DEFAULT_IMPACT_ITEMS.map((item) => ({ ...item })),
    gallery: DEFAULT_GALLERY.map((item) => ({ ...item })),
    sponsors: [],
    funnelSteps: DEFAULT_FUNNEL_STEPS.map((item) => ({ ...item })),
  };
}

/**
 * True when the filesystem is writable but thrown away between invocations —
 * a serverless platform. Writes succeed, which makes a plain "can I write?"
 * check report healthy right up until the records disappear, so this has to
 * be detected from the environment instead.
 */
export function detectEphemeralFilesystem(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME || env.FUNCTIONS_WORKER_RUNTIME);
}

export class JsonStore implements DataStore {
  readonly driver = 'json' as const;

  private db: Database = emptyDatabase();
  private file: string;
  private persistent = true;
  private writeChain: Promise<void> = Promise.resolve();
  private loaded = false;

  /** Writes land somewhere that will not survive the next request. */
  readonly ephemeral: boolean;

  constructor(dataDir: string, ephemeral = detectEphemeralFilesystem()) {
    this.file = path.join(dataDir, 'silvercrest.json');
    this.ephemeral = ephemeral;
  }

  /** Reads the database off disk. Safe to call more than once. */
  async init(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    try {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const raw = await fs.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw) as Partial<Database>;
      const base = emptyDatabase();
      this.db = {
        applications: parsed.applications ?? base.applications,
        payments: parsed.payments ?? base.payments,
        // Merged, not replaced: a stored file written before a new setting
        // existed must still pick up that setting's default. Unknown keys are
        // dropped so junk written by an older build cannot accumulate.
        settings: pruneSettings({ ...base.settings, ...(parsed.settings ?? {}) }, base.settings),
        programme: parsed.programme ?? base.programme,
        welcomePack: parsed.welcomePack ?? base.welcomePack,
        impactItems: parsed.impactItems ?? base.impactItems,
        gallery: parsed.gallery ?? base.gallery,
        sponsors: parsed.sponsors ?? base.sponsors ?? [],
        funnelSteps: parsed.funnelSteps ?? base.funnelSteps ?? [],
      };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        // First run: create the file so we fail fast if the dir is unwritable.
        await this.flush().catch(() => undefined);
      } else if (code === 'EROFS' || code === 'EACCES' || code === 'EPERM') {
        this.persistent = false;
        console.warn(
          '[store] Data directory is not writable. Running in memory only — ' +
            'records will be lost on restart. Configure a database before taking live payments.',
        );
      } else {
        console.error('[store] Could not read the database, starting empty:', err);
      }
    }
  }


  /**
   * Records will still be here after a restart. False on a read-only disk and
   * false on serverless, where the write succeeds but the disk does not last.
   */
  get isPersistent(): boolean {
    return this.persistent && !this.ephemeral;
  }

  /** Human-readable explanation for the dashboard. */
  get storageNote(): string {
    if (this.ephemeral) {
      return 'Serverless filesystem detected. Writes succeed but are discarded between requests, so applications and payments WILL be lost. Deploy to a host with a persistent disk, or move the store to a database, before taking real payments.';
    }
    if (!this.persistent) {
      return 'The data directory is not writable — running in memory only. Records will be lost on restart.';
    }
    return 'Records are written to disk.';
  }

  /** Queues a write. Callers await this so a request only returns once saved. */
  private save(): Promise<void> {
    if (!this.persistent) return Promise.resolve();
    this.writeChain = this.writeChain.then(() => this.flush()).catch((err) => {
      console.error('[store] Write failed:', err);
    });
    return this.writeChain;
  }

  private async flush(): Promise<void> {
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(this.db, null, 2), 'utf8');
    await fs.rename(tmp, this.file);
  }

  // ---------------------------------------------------------------- applications

  async listApplications(): Promise<Application[]> {
    return [...this.db.applications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getApplication(idOrReference: string): Promise<Application | undefined> {
    return this.db.applications.find(
      (a) => a.id === idOrReference || a.reference === idOrReference,
    );
  }

  async findApplicationByEmail(email: string): Promise<Application | undefined> {
    const needle = email.trim().toLowerCase();
    return this.db.applications.find((a) => a.email.toLowerCase() === needle);
  }

  async addApplication(app: Application): Promise<Application> {
    this.db.applications.push(app);
    await this.save();
    return app;
  }

  async updateApplication(
    id: string,
    patch: Partial<Application>,
  ): Promise<Application | undefined> {
    const index = this.db.applications.findIndex((a) => a.id === id || a.reference === id);
    if (index === -1) return undefined;

    this.db.applications[index] = {
      ...this.db.applications[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await this.save();
    return this.db.applications[index];
  }

  async deleteApplication(id: string): Promise<boolean> {
    const before = this.db.applications.length;
    this.db.applications = this.db.applications.filter((a) => a.id !== id && a.reference !== id);
    if (this.db.applications.length !== before) {
      await this.save();
      return true;
    }
    return false;
  }

  async countApplicationsByStatus(): Promise<Record<ApplicationStatus, number>> {
    const counts: Record<ApplicationStatus, number> = {
      PENDING_REVIEW: 0,
      APPROVED: 0,
      PAID: 0,
      REJECTED: 0,
      WAITLISTED: 0,
    };
    for (const app of this.db.applications) {
      counts[app.status] = (counts[app.status] ?? 0) + 1;
    }
    return counts;
  }

  /** Seats are consumed only once a ticket is actually paid for. */
  async countPaidSeats(): Promise<number> {
    return this.db.applications
      .filter((a) => a.status === 'PAID')
      .reduce((seats, a) => seats + seatsFor(a), 0);
  }

  // -------------------------------------------------------------------- payments

  async listPayments(): Promise<Payment[]> {
    return [...this.db.payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getPayment(idOrReference: string): Promise<Payment | undefined> {
    return this.db.payments.find(
      (p) => p.id === idOrReference || p.reference === idOrReference,
    );
  }

  async addPayment(payment: Payment): Promise<Payment> {
    this.db.payments.push(payment);
    await this.save();
    return payment;
  }

  async updatePayment(id: string, patch: Partial<Payment>): Promise<Payment | undefined> {
    const index = this.db.payments.findIndex((p) => p.id === id || p.reference === id);
    if (index === -1) return undefined;

    this.db.payments[index] = {
      ...this.db.payments[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await this.save();
    return this.db.payments[index];
  }

  async completedPayments(): Promise<Payment[]> {
    return this.db.payments.filter((p) => p.status === 'COMPLETE');
  }

  // ----------------------------------------------------------- event settings & content

  async getSettings(): Promise<EventSettings> {
    return { ...this.db.settings };
  }

  async updateSettings(patch: Partial<EventSettings>): Promise<EventSettings> {
    this.db.settings = {
      ...this.db.settings,
      ...patch,
    };
    await this.save();
    return { ...this.db.settings };
  }

  async getProgramme(): Promise<ProgrammeItem[]> {
    return [...this.db.programme];
  }

  async updateProgramme(items: ProgrammeItem[]): Promise<ProgrammeItem[]> {
    this.db.programme = items.map((item, i) => ({
      ...item,
      id: item.id || `prog-${i + 1}`,
    }));
    await this.save();
    return [...this.db.programme];
  }

  async getWelcomePack(): Promise<WelcomePackItem[]> {
    return [...this.db.welcomePack];
  }

  async updateWelcomePack(items: WelcomePackItem[]): Promise<WelcomePackItem[]> {
    this.db.welcomePack = items.map((item, i) => ({
      ...item,
      id: item.id || `wp-${i + 1}`,
    }));
    await this.save();
    return [...this.db.welcomePack];
  }

  async getImpactItems(): Promise<ImpactItem[]> {
    return [...this.db.impactItems];
  }

  async getGallery(): Promise<GalleryItem[]> {
    const items = this.db.gallery;
    return items && items.length > 0 ? [...items] : DEFAULT_GALLERY.map((item) => ({ ...item }));
  }

  async updateGallery(items: GalleryItem[]): Promise<GalleryItem[]> {
    this.db.gallery = items;
    await this.save();
    return items;
  }

  async getFunnelSteps(): Promise<FunnelStepItem[]> {
    return [...(this.db.funnelSteps ?? DEFAULT_FUNNEL_STEPS)];
  }

  async updateFunnelSteps(items: FunnelStepItem[]): Promise<FunnelStepItem[]> {
    this.db.funnelSteps = items;
    await this.save();
    return items;
  }

  async getSponsors(): Promise<Sponsor[]> {
    return [...(this.db.sponsors ?? [])];
  }

  async updateSponsors(items: Sponsor[]): Promise<Sponsor[]> {
    this.db.sponsors = items;
    await this.save();
    return items;
  }

  async updateImpactItems(items: ImpactItem[]): Promise<ImpactItem[]> {
    this.db.impactItems = items.map((item, i) => ({
      ...item,
      id: item.id || `imp-${i + 1}`,
    }));
    await this.save();
    return [...this.db.impactItems];
  }
}

/** Short, unambiguous reference code. Excludes characters that misread aloud. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeReference(prefix: string, length = 6): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `${prefix}-${out}`;
}

export function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
