/**
 * Domain types shared by the React client and the Express server.
 * Keep this file free of runtime imports so it can be pulled into either side.
 */

/** Where an SME sits in the vetting funnel (proposal, section 04). */
export type ApplicationStatus =
  | 'PENDING_REVIEW' // submitted, awaiting CIPC / digital footprint check
  | 'APPROVED'       // vetted, payment link issued
  | 'PAID'           // R350 settled, digital ticket issued
  | 'REJECTED'       // did not meet the SME criteria
  | 'WAITLISTED';    // approved but the room is full

export type PaymentStatus = 'PENDING' | 'COMPLETE' | 'FAILED' | 'CANCELLED';

export type PaymentKind = 'TICKET' | 'DONATION';

export interface Application {
  id: string;
  /** Human-readable reference shown to the applicant, e.g. SCC26-A7F3K2. */
  reference: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  industry: string;
  website?: string;
  /** CIPC registration number, optional at application time. */
  registrationNumber?: string;
  /** Free-text: what the business does and what it wants from the room. */
  about: string;
  /** What the applicant hopes to get out of the event. */
  lookingFor?: string;
  status: ApplicationStatus;
  /** Internal note captured by the Silver Crest team during vetting. */
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Set once the R350 ticket payment completes. */
  paymentId?: string;
  ticketCode?: string;
}

export interface Payment {
  id: string;
  /** The m_payment_id we hand to PayFast; unique per attempt. */
  reference: string;
  kind: PaymentKind;
  /** Rands, 2dp. */
  amountZAR: number;
  status: PaymentStatus;
  /** Payer details captured before redirecting to PayFast. */
  name: string;
  email: string;
  /** Set for TICKET payments. */
  applicationId?: string;
  /** Optional public dedication shown on the supporters wall. */
  message?: string;
  /** True when the donor asked to stay anonymous. */
  anonymous?: boolean;
  /** PayFast's own transaction id, populated by the ITN callback. */
  pfPaymentId?: string;
  /** Raw payment_status string PayFast last sent us. */
  pfPaymentStatus?: string;
  /** Net amount after PayFast fees, from the ITN payload. */
  amountNetZAR?: number;
  feeZAR?: number;
  /** Why an ITN was rejected, if it was. Surfaced in the admin dashboard. */
  itnError?: string;
  itnReceivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Shape returned by POST /api/checkout/* — the client auto-posts this to PayFast. */
export interface CheckoutResponse {
  success: true;
  paymentId: string;
  reference: string;
  amountZAR: number;
  /** PayFast process endpoint (sandbox or live). */
  processUrl: string;
  /** Every field to render as a hidden input, signature included. */
  fields: Record<string, string>;
}

export interface ApiError {
  success: false;
  error: string;
  /** Per-field validation messages, keyed by field name. */
  fieldErrors?: Record<string, string>;
}

/** Aggregate figures shown on the admin dashboard and the public impact meter. */
export interface DashboardStats {
  ticketsSold: number;
  ticketsRevenueZAR: number;
  donationsCount: number;
  donationsRevenueZAR: number;
  totalRaisedZAR: number;
  netRaisedZAR: number;
  feesZAR: number;
  applications: Record<ApplicationStatus, number>;
  seatsRemaining: number;
  capacity: number;
}

/** Non-secret PayFast configuration echoed to the admin dashboard. */
export interface PayFastConfigStatus {
  configured: boolean;
  mode: 'sandbox' | 'live';
  merchantId: string;
  /** Masked — never the real key. */
  merchantKeyMasked: string;
  passphraseSet: boolean;
  processUrl: string;
  notifyUrl: string;
  returnUrl: string;
  cancelUrl: string;
  /** Problems that would break a live payment, e.g. missing passphrase. */
  warnings: string[];
}
