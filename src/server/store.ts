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
import type { Application, ApplicationStatus, Payment } from '../types.js';

interface Database {
  applications: Application[];
  payments: Payment[];
}

const EMPTY: Database = { applications: [], payments: [] };

export class Store {
  private db: Database = { ...EMPTY, applications: [], payments: [] };
  private file: string;
  private persistent = true;
  private writeChain: Promise<void> = Promise.resolve();
  private loaded = false;

  constructor(dataDir: string) {
    this.file = path.join(dataDir, 'silvercrest.json');
  }

  /** Reads the database off disk. Safe to call more than once. */
  async init(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    try {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const raw = await fs.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw) as Partial<Database>;
      this.db = {
        applications: parsed.applications ?? [],
        payments: parsed.payments ?? [],
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

  get isPersistent(): boolean {
    return this.persistent;
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

  listApplications(): Application[] {
    return [...this.db.applications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getApplication(idOrReference: string): Application | undefined {
    return this.db.applications.find(
      (a) => a.id === idOrReference || a.reference === idOrReference,
    );
  }

  findApplicationByEmail(email: string): Application | undefined {
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

  countApplicationsByStatus(): Record<ApplicationStatus, number> {
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
  countPaidSeats(): number {
    return this.db.applications.filter((a) => a.status === 'PAID').length;
  }

  // -------------------------------------------------------------------- payments

  listPayments(): Payment[] {
    return [...this.db.payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getPayment(idOrReference: string): Payment | undefined {
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

  completedPayments(): Payment[] {
    return this.db.payments.filter((p) => p.status === 'COMPLETE');
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
