export const PRISMA_SCHEMA_CODE = `// ============================================================================
// Prisma Database Schema for Silver Crest Connect (Presented by Silver Crest Consulting)
// Stack: PostgreSQL + Prisma ORM / TypeScript
// Features: User Roles, Stall Inventory, Double-Booking Locks, Payment Status,
//           and "Verified" External Business Badge Integration.
// ============================================================================

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ----------------------------------------------------------------------------
// 1. USER MODEL (Attendees, Exhibitors, Sponsors, Admins)
// ----------------------------------------------------------------------------
enum UserRole {
  ATTENDEE
  EXHIBITOR
  SPONSOR
  ADMIN
}

model User {
  id              String         @id @default(uuid())
  email           String         @unique
  name            String
  companyName     String
  role            UserRole       @default(EXHIBITOR)
  phone           String?
  website         String?
  industry        String?
  
  // Relations
  bookings        Booking[]
  stallsHeld      Stall[]        @relation("StallHeldByUser")
  stallsBooked    Stall[]        @relation("StallBookedByUser")
  verifiedBadge   VerifiedBadge?
  
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([email])
  @@index([companyName])
}

// ----------------------------------------------------------------------------
// 2. VERIFIED BADGE MODEL (API-First Integration with "Verified" Platform)
// ----------------------------------------------------------------------------
enum BadgeTier {
  GOLD_TIER
  PLATINUM_TIER
  VERIFIED_LEADER
}

model VerifiedBadge {
  id                 String     @id @default(uuid())
  userId             String     @unique
  user               User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  companyName        String
  registrationNumber String     // e.g. State Registration or Company House ID
  taxId              String     // EIN or VAT Registration ID
  trustScore         Int        @default(90) // 0 - 100 Trust Score
  badgeTier          BadgeTier  @default(GOLD_TIER)
  verifiedAt         DateTime   @default(now())
  expiresAt          DateTime
  isVerified         Boolean    @default(true)
  issuer             String     @default("Verified Platform Inc.")

  // Linked Stalls displaying the badge on floor plan
  stalls             Stall[]

  createdAt          DateTime   @default(now())
}

// ----------------------------------------------------------------------------
// 3. STALL MODEL (Exhibition Hall Inventory & Availability Locks)
// ----------------------------------------------------------------------------
enum StallTier {
  STANDARD
  PREMIUM
  PLATINUM
  VIP_ISLAND
}

enum StallStatus {
  AVAILABLE
  RESERVED
  BOOKED
  ON_HOLD
}

model Stall {
  id                   String        @id @default(uuid())
  code                 String        @unique // e.g. "A-101", "VIP-01"
  hall                 String        // "Hall A - Main Innovation", "VIP Central Atrium"
  row                  Int
  col                  Int
  widthMeters          Float         @default(3.0)
  depthMeters          Float         @default(3.0)
  tier                 StallTier     @default(STANDARD)
  basePriceZAR         Decimal       @db.Decimal(10, 2)
  status               StallStatus   @default(AVAILABLE)
  isCorner             Boolean       @default(false)
  powerSupplyKw        Float         @default(2.0)
  wifiSpeedMbps        Int           @default(100)
  amenities            String[]      // JSON Array of amenity strings
  
  // Temporary 10-Minute Lock State to Prevent Double-Booking
  currentHoldExpiresAt DateTime?
  heldByUserId         String?
  heldByUser           User?         @relation("StallHeldByUser", fields: [heldByUserId], references: [id])

  // Confirmed Occupant
  bookedByUserId       String?
  bookedByUser         User?         @relation("StallBookedByUser", fields: [bookedByUserId], references: [id])
  bookedCompany        String?
  
  verifiedBadgeId      String?
  verifiedBadge        VerifiedBadge? @relation(fields: [verifiedBadgeId], references: [id])

  bookings             Booking[]

  createdAt            DateTime      @default(now())
  updatedAt            DateTime      @updatedAt

  @@index([status])
  @@index([hall])
  @@index([tier])
}

// ----------------------------------------------------------------------------
// 4. BOOKING MODEL (Transactions, Add-Ons, Deposit Options & Receipts)
// ----------------------------------------------------------------------------
enum PaymentStatus {
  PENDING
  RESERVED
  COMPLETED
  FAILED
  REFUNDED
}

enum PaymentMethod {
  CREDIT_CARD
  BANK_WIRE
  APPLE_PAY
  CORPORATE_INVOICE
}

model Booking {
  id                   String        @id @default(uuid())
  bookingCode          String        @unique // e.g. "SCC-2026-X892"
  
  userId               String
  user                 User          @relation(fields: [userId], references: [id])
  
  stallId              String
  stall                Stall         @relation(fields: [stallId], references: [id])
  
  tier                 StallTier
  selectedAddOnsJson   Json          // Selected AddOns array
  isDepositOnly        Boolean       @default(false) // 30% deposit option
  amountPaidZAR        Decimal       @db.Decimal(10, 2)
  totalAmountZAR       Decimal       @db.Decimal(10, 2)
  
  paymentStatus        PaymentStatus @default(PENDING)
  paymentMethod        PaymentMethod?
  paymentTransactionId String?       @unique
  
  verifiedBadgeAttached Boolean      @default(false)
  qrCodeUrl            String?
  invoiceNumber        String        @unique
  
  createdAt            DateTime      @default(now())
  updatedAt            DateTime      @updatedAt

  @@index([userId])
  @@index([stallId])
  @@index([paymentStatus])
}

// ----------------------------------------------------------------------------
// 5. WEBHOOK LOG MODEL (Stripe/Payment Gateway Webhooks & Idempotency)
// ----------------------------------------------------------------------------
model WebhookLog {
  id              String   @id @default(uuid())
  eventId         String   @unique // Gateway Webhook Event ID
  eventType       String   // e.g. "checkout.session.completed", "payment_intent.succeeded"
  payload         Json
  status          String   @default("PROCESSED") // PROCESSED, FAILED, RETRIED
  processedAt     DateTime @default(now())

  @@index([eventId])
  @@index([eventType])
}

// ----------------------------------------------------------------------------
// 6. ATTENDEE & NETWORKING HUB MODELS (B2B Matchmaking, QR Swaps & Messages)
// ----------------------------------------------------------------------------
model AttendeeProfile {
  id              String   @id @default(uuid())
  userId          String?  @unique
  name            String
  title           String
  companyName     String
  industry        String
  email           String
  phone           String?
  linkedin        String?
  bio             String
  avatarUrl       String
  role            String   @default("ATTENDEE") // ATTENDEE, EXHIBITOR, SPEAKER, SPONSOR
  trustScore      Int      @default(95)
  isVerified      Boolean  @default(true)
  qrCodeData      String   @unique
  boothCode       String?
  lookingFor      String[]

  createdAt       DateTime @default(now())
}

model Connection {
  id              String   @id @default(uuid())
  requesterId     String
  receiverId      String
  connectedAt     DateTime @default(now())
  notes           String?

  @@unique([requesterId, receiverId])
}

model DirectMessage {
  id              String   @id @default(uuid())
  senderId        String
  receiverId      String
  content         String
  meetingLocation String?  // Optional 1-on-1 coffee meeting details
  meetingTime     String?
  createdAt       DateTime @default(now())

  @@index([senderId, receiverId])
}
`;

