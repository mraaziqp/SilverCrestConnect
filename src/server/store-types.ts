/**
 * The storage contract.
 *
 * Two drivers implement this: a local JSON file, and Firestore. Every method
 * is async even where the JSON driver could answer synchronously — a remote
 * database cannot, and one interface is worth more than a few saved awaits.
 *
 * This matters most on serverless. A cached in-memory copy would go stale
 * between instances, so a PayFast callback could land on a worker that has
 * never heard of the payment it is confirming. Reads go to the source.
 */

import type {
  Application,
  ApplicationStatus,
  EventSettings,
  ImpactItem,
  Payment,
  ProgrammeItem,
  WelcomePackItem,
  GalleryItem,
} from '../types.js';

export interface DataStore {
  /** Prepares the driver. Safe to call more than once. */
  init(): Promise<void>;

  /** False when records will not survive — a read-only or ephemeral disk. */
  readonly isPersistent: boolean;
  /** Human-readable explanation of the storage situation, for /admin. */
  readonly storageNote: string;
  /** Which driver is in use, for the dashboard. */
  readonly driver: 'json' | 'firestore' | 'rtdb';

  // applications
  listApplications(): Promise<Application[]>;
  getApplication(idOrReference: string): Promise<Application | undefined>;
  findApplicationByEmail(email: string): Promise<Application | undefined>;
  addApplication(app: Application): Promise<Application>;
  updateApplication(id: string, patch: Partial<Application>): Promise<Application | undefined>;
  countApplicationsByStatus(): Promise<Record<ApplicationStatus, number>>;
  countPaidSeats(): Promise<number>;

  // payments
  listPayments(): Promise<Payment[]>;
  getPayment(idOrReference: string): Promise<Payment | undefined>;
  addPayment(payment: Payment): Promise<Payment>;
  updatePayment(id: string, patch: Partial<Payment>): Promise<Payment | undefined>;
  completedPayments(): Promise<Payment[]>;

  // editable content
  getSettings(): Promise<EventSettings>;
  updateSettings(patch: Partial<EventSettings>): Promise<EventSettings>;
  getProgramme(): Promise<ProgrammeItem[]>;
  updateProgramme(items: ProgrammeItem[]): Promise<ProgrammeItem[]>;
  getWelcomePack(): Promise<WelcomePackItem[]>;
  updateWelcomePack(items: WelcomePackItem[]): Promise<WelcomePackItem[]>;
  getImpactItems(): Promise<ImpactItem[]>;
  updateImpactItems(items: ImpactItem[]): Promise<ImpactItem[]>;
  getGallery(): Promise<GalleryItem[]>;
  updateGallery(items: GalleryItem[]): Promise<GalleryItem[]>;
}
