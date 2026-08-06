export type StallTier = 'STANDARD' | 'PREMIUM' | 'PLATINUM' | 'VIP_ISLAND';

export type StallStatus = 'AVAILABLE' | 'RESERVED' | 'BOOKED' | 'ON_HOLD';

export type UserRole = 'ATTENDEE' | 'EXHIBITOR' | 'SPONSOR' | 'ADMIN';

export type PaymentStatus = 'PENDING' | 'RESERVED' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export type PaymentMethod = 'CREDIT_CARD' | 'BANK_WIRE' | 'APPLE_PAY' | 'CORPORATE_INVOICE';

export interface VerifiedBadge {
  id: string;
  companyName: string;
  registrationNumber: string;
  taxId: string;
  trustScore: number; // e.g. 98/100
  badgeTier: 'GOLD_TIER' | 'PLATINUM_TIER' | 'VERIFIED_LEADER';
  verifiedAt: string;
  expiresAt: string;
  issuer: 'Verified Platform Inc.';
  isVerified: boolean;
}

export interface AttendeeProfile {
  id: string;
  name: string;
  title: string;
  companyName: string;
  industry: string;
  email: string;
  phone?: string;
  linkedin?: string;
  bio: string;
  avatarUrl: string;
  role: 'ATTENDEE' | 'EXHIBITOR' | 'SPEAKER' | 'SPONSOR';
  trustScore: number;
  isVerified: boolean;
  qrCodeData: string;
  boothCode?: string;
  lookingFor: string[];
}

export interface Connection {
  id: string;
  attendeeId: string;
  connectedAt: string;
  notes?: string;
  tags?: string[];
}

export interface CoffeeMeetingRequest {
  id: string;
  location: string; // e.g. "Hall A Executive Lounge"
  date: string;
  time: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  note?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  meetingRequest?: CoffeeMeetingRequest;
}

export interface User {
  id: string;
  name: string;
  email: string;
  companyName: string;
  role: UserRole;
  phone?: string;
  website?: string;
  industry?: string;
  verifiedBadge?: VerifiedBadge;
  createdAt: string;
}

export interface StallAmenity {
  id: string;
  name: string;
  icon: string;
}

export interface Stall {
  id: string;
  code: string; // e.g., "A-101", "VIP-01"
  hall: 'Hall A - Main Innovation' | 'Hall B - Tech & SME' | 'VIP Central Atrium';
  row: number;
  col: number;
  widthMeters: number;
  depthMeters: number;
  tier: StallTier;
  basePriceUSD: number;
  status: StallStatus;
  isCorner: boolean;
  powerSupplyKw: number;
  wifiSpeedMbps: number;
  amenities: string[];
  currentHoldExpiresAt?: string; // ISO string for 10-min reservation lock
  heldByUserId?: string;
  bookedByUserId?: string;
  bookedCompany?: string;
  bookedCompanyLogo?: string;
  verifiedBadgeId?: string;
}

export interface AddOnOption {
  id: string;
  name: string;
  description: string;
  priceUSD: number;
}

export interface Booking {
  id: string;
  bookingCode: string; // e.g., "SCC-2026-X892"
  userId: string;
  userName: string;
  userEmail: string;
  companyName: string;
  stallId: string;
  stallCode: string;
  stallHall: string;
  tier: StallTier;
  selectedAddOns: AddOnOption[];
  isDepositOnly: boolean; // 30% deposit vs full payment
  amountPaidUSD: number;
  totalAmountUSD: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentTransactionId?: string;
  verifiedBadgeAttached: boolean;
  qrCodeUrl: string;
  invoiceNumber: string;
  createdAt: string;
  expiresAt?: string;
}

export interface CheckoutSessionRequest {
  stallId: string;
  userId: string;
  companyName: string;
  email: string;
  phone?: string;
  website?: string;
  taxId?: string;
  selectedAddOnIds: string[];
  isDepositOnly: boolean;
  paymentMethod: PaymentMethod;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  bookingId: string;
  checkoutUrl: string;
  amountToPay: number;
  currency: string;
  expiresAt: string;
  status: 'INITIATED' | 'COMPLETED' | 'FAILED';
  verifiedStatus: {
    isVerified: boolean;
    trustScore: number;
    badgeTier?: string;
  };
}
