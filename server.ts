import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { MOCK_STALLS, MOCK_ADD_ONS, INITIAL_BOOKINGS, MOCK_USERS, MOCK_ATTENDEES, INITIAL_CHAT_MESSAGES } from './src/data/mockData.js';
import { Stall, Booking, CheckoutSessionRequest, CheckoutSessionResponse, VerifiedBadge } from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory databases for demo session persistence
let stalls: Stall[] = [...MOCK_STALLS];
let bookings: Booking[] = [...INITIAL_BOOKINGS];
let users = [...MOCK_USERS];
let attendees = [...MOCK_ATTENDEES];
let chatMessages = [...INITIAL_CHAT_MESSAGES];
let savedConnections: any[] = [
  { id: 'conn-1', attendeeId: 'att-1', connectedAt: '2026-10-14T09:30:00Z', notes: 'Discussed cloud API integration' },
  { id: 'conn-2', attendeeId: 'att-2', connectedAt: '2026-10-14T10:45:00Z', notes: 'Private equity investment query' },
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper: Release expired holds
  const cleanupExpiredHolds = () => {
    const now = new Date();
    stalls = stalls.map((stall) => {
      if (stall.status === 'ON_HOLD' && stall.currentHoldExpiresAt) {
        if (new Date(stall.currentHoldExpiresAt) < now) {
          return {
            ...stall,
            status: 'AVAILABLE',
            currentHoldExpiresAt: undefined,
            heldByUserId: undefined,
          };
        }
      }
      return stall;
    });
  };

  // --------------------------------------------------------------------------
  // API ENDPOINTS
  // --------------------------------------------------------------------------

  // 1. Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      event: 'Silver Crest Connect',
      presentedBy: 'Silver Crest Consulting',
      timestamp: new Date().toISOString(),
    });
  });

  // 2. GET /api/stalls - Fetch floor plan inventory
  app.get('/api/stalls', (req: Request, res: Response) => {
    cleanupExpiredHolds();
    const { hall, tier, status } = req.query;

    let filtered = [...stalls];
    if (hall) {
      filtered = filtered.filter((s) => s.hall === String(hall));
    }
    if (tier) {
      filtered = filtered.filter((s) => s.tier === String(tier));
    }
    if (status) {
      filtered = filtered.filter((s) => s.status === String(status));
    }

    res.json({
      success: true,
      count: filtered.length,
      stalls: filtered,
    });
  });

  // 3. POST /api/stalls/reserve - Hold stall for 10 minutes (Prevents Double Booking)
  app.post('/api/stalls/reserve', (req: Request, res: Response) => {
    cleanupExpiredHolds();
    const { stallId, userId, companyName } = req.body;

    if (!stallId) {
      return res.status(400).json({ success: false, error: 'stallId is required' });
    }

    const stallIndex = stalls.findIndex((s) => s.id === stallId || s.code === stallId);
    if (stallIndex === -1) {
      return res.status(404).json({ success: false, error: 'Stall not found' });
    }

    const stall = stalls[stallIndex];

    if (stall.status === 'BOOKED') {
      return res.status(409).json({
        success: false,
        error: 'Stall is already booked by another company.',
      });
    }

    if (stall.status === 'ON_HOLD' && stall.heldByUserId && stall.heldByUserId !== userId) {
      return res.status(409).json({
        success: false,
        error: 'Stall is currently being reserved by another exhibitor. Try again in a few minutes.',
      });
    }

    // Set 10 minute lock
    const holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    stalls[stallIndex] = {
      ...stall,
      status: 'ON_HOLD',
      currentHoldExpiresAt: holdExpiresAt,
      heldByUserId: userId || 'temp-session-user',
    };

    return res.json({
      success: true,
      message: `Stall ${stall.code} held successfully for 10 minutes.`,
      stall: stalls[stallIndex],
      expiresAt: holdExpiresAt,
    });
  });

  // 4. POST /api/payments/checkout-session - Initiate payment session
  app.post('/api/payments/checkout-session', (req: Request, res: Response) => {
    const {
      stallId,
      userId = 'usr-' + Math.random().toString(36).substring(2, 6),
      companyName,
      email,
      phone,
      website,
      taxId,
      selectedAddOnIds = [],
      isDepositOnly = false,
      paymentMethod = 'CREDIT_CARD',
    }: CheckoutSessionRequest = req.body;

    if (!stallId || !companyName || !email) {
      return res.status(400).json({
        success: false,
        error: 'stallId, companyName, and email are required parameters.',
      });
    }

    const stall = stalls.find((s) => s.id === stallId || s.code === stallId);
    if (!stall) {
      return res.status(404).json({ success: false, error: 'Stall not found.' });
    }

    // Calculate totals
    const addOns = MOCK_ADD_ONS.filter((a) => selectedAddOnIds.includes(a.id));
    const addOnsTotal = addOns.reduce((sum, a) => sum + a.priceZAR, 0);
    const subtotal = stall.basePriceZAR + addOnsTotal;
    const taxVat = subtotal * 0.15; // 15% SA VAT
    const totalAmount = Math.round((subtotal + taxVat) * 100) / 100;
    const amountToPay = isDepositOnly ? Math.round(totalAmount * 0.3 * 100) / 100 : totalAmount;

    // Simulate "Verified" platform lookup
    const isVerifiedEligible = Boolean(taxId && taxId.length >= 5) || companyName.toLowerCase().includes('crest') || companyName.toLowerCase().includes('vance') || companyName.toLowerCase().includes('tech');
    const trustScore = isVerifiedEligible ? Math.floor(Math.random() * 8) + 92 : 88;

    const bookingId = 'bkg-' + Math.random().toString(36).substring(2, 8);
    const bookingCode = `SCC-2026-${stall.code.replace('-', '')}`;
    const invoiceNum = `INV-SCC-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const newBooking: Booking = {
      id: bookingId,
      bookingCode,
      userId,
      userName: companyName + ' Representative',
      userEmail: email,
      companyName,
      stallId: stall.id,
      stallCode: stall.code,
      stallHall: stall.hall,
      tier: stall.tier,
      selectedAddOns: addOns,
      isDepositOnly,
      amountPaidZAR: amountToPay,
      totalAmountZAR: totalAmount,
      paymentStatus: 'PENDING',
      paymentMethod,
      verifiedBadgeAttached: isVerifiedEligible,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${bookingCode}-${encodeURIComponent(companyName)}`,
      invoiceNumber: invoiceNum,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };

    bookings.push(newBooking);

    const sessionResponse: CheckoutSessionResponse = {
      sessionId: 'cs_scc_' + Math.random().toString(36).substring(2, 12),
      bookingId,
      checkoutUrl: `/checkout/${bookingId}`,
      amountToPay,
      currency: 'ZAR',
      expiresAt: newBooking.expiresAt!,
      status: 'INITIATED',
      verifiedStatus: {
        isVerified: isVerifiedEligible,
        trustScore,
        badgeTier: isVerifiedEligible ? 'PLATINUM_TIER' : undefined,
      },
    };

    return res.json({
      success: true,
      session: sessionResponse,
      booking: newBooking,
      pricingBreakdown: {
        basePriceZAR: stall.basePriceZAR,
        addOnsTotalZAR: addOnsTotal,
        subtotalZAR: subtotal,
        taxVat15ZAR: taxVat,
        totalZAR: totalAmount,
        amountToPayZAR: amountToPay,
        isDeposit: isDepositOnly,
      },
    });
  });

  // 5. POST /api/payments/confirm - Confirm booking & finalize stall state
  app.post('/api/payments/confirm', (req: Request, res: Response) => {
    const { bookingId, transactionId = 'TXN-' + Math.random().toString(36).substring(2, 9) } = req.body;

    const bIndex = bookings.findIndex((b) => b.id === bookingId);
    if (bIndex === -1) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const booking = bookings[bIndex];
    booking.paymentStatus = 'COMPLETED';
    booking.paymentTransactionId = transactionId;

    // Update Stall to BOOKED
    const sIndex = stalls.findIndex((s) => s.id === booking.stallId);
    if (sIndex !== -1) {
      stalls[sIndex] = {
        ...stalls[sIndex],
        status: 'BOOKED',
        bookedByUserId: booking.userId,
        bookedCompany: booking.companyName,
        currentHoldExpiresAt: undefined,
        heldByUserId: undefined,
      };
    }

    return res.json({
      success: true,
      message: 'Payment confirmed successfully. Stall reserved.',
      booking,
      stall: sIndex !== -1 ? stalls[sIndex] : null,
    });
  });

  // 6a. GET /api/bookings - List all bookings
  app.get('/api/bookings', (req: Request, res: Response) => {
    return res.json({
      success: true,
      count: bookings.length,
      bookings,
    });
  });

  // 6b. GET /api/bookings/:id - Get booking receipt
  app.get('/api/bookings/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const booking = bookings.find((b) => b.id === id || b.bookingCode === id);

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const stall = stalls.find((s) => s.id === booking.stallId);

    return res.json({
      success: true,
      booking,
      stall,
    });
  });

  // 7. GET /api/verified/lookup - External "Verified" Business Verification Platform Endpoint
  app.get('/api/verified/lookup', (req: Request, res: Response) => {
    const { taxId, company } = req.query;

    const searchStr = (taxId || company || '').toString().toLowerCase();

    if (!searchStr) {
      return res.status(400).json({ success: false, error: 'Provide taxId or company query param.' });
    }

    const isVerified = searchStr.length >= 4;
    const badge: VerifiedBadge = {
      id: 'vbdg-' + Math.floor(1000 + Math.random() * 9000),
      companyName: (company as string) || 'Verified Business Entity',
      registrationNumber: `US-REG-${Math.floor(1000000 + Math.random() * 9000000)}`,
      taxId: (taxId as string) || 'EIN-99-402910',
      trustScore: isVerified ? Math.floor(Math.random() * 5) + 95 : 75,
      badgeTier: 'PLATINUM_TIER',
      verifiedAt: new Date().toISOString().split('T')[0],
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      issuer: 'Verified Platform Inc.',
      isVerified,
    };

    return res.json({
      success: true,
      verified: isVerified,
      badge,
      metadata: {
        apiEndpoint: 'https://api.verifiedplatform.com/v1/trust-badge',
        verificationChecksPassed: ['State Secretary Registry', 'Federal Tax ID Lookup', 'Anti-Fraud Risk Check', 'Corporate Credit Audit'],
      },
    });
  });

  // 8. POST /api/verified-bizlink/verify - Dedicated VerifiedBizLink API Query
  app.post('/api/verified-bizlink/verify', (req: Request, res: Response) => {
    const { taxId, companyName, registrationNumber } = req.body;

    const isVerified = Boolean(taxId || companyName);
    const trustScore = 98;

    return res.json({
      success: true,
      status: 'VERIFIED',
      trustScore,
      companyName: companyName || 'Silver Crest Partner LLC',
      taxId: taxId || 'EIN-99-8120491',
      registrationNumber: registrationNumber || 'US-DEL-9918230',
      badgeTier: 'PLATINUM_TIER',
      verifiedAt: new Date().toISOString(),
      networkSignature: 'vbl_sig_' + Math.random().toString(36).substring(2, 12),
      verificationDetails: {
        secretaryOfStateVerified: true,
        sanctionsListCheck: 'CLEARED',
        creditRiskGrade: 'AAA',
        verifiedBy: 'VerifiedBizLink Platform v2.4',
      },
    });
  });

  // 9. POST /api/webhooks/payment-gateway - Payment Webhook listener (Stripe/Payment Gateway)
  app.post('/api/webhooks/payment-gateway', (req: Request, res: Response) => {
    const { eventType, paymentIntentId, bookingId, metadata } = req.body;

    if (eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded') {
      const targetBookingId = bookingId || metadata?.bookingId;
      const bIndex = bookings.findIndex((b) => b.id === targetBookingId || b.bookingCode === targetBookingId);

      if (bIndex !== -1) {
        bookings[bIndex].paymentStatus = 'COMPLETED';
        bookings[bIndex].paymentTransactionId = paymentIntentId || 'wh_tx_' + Date.now();

        // Transition stall from ON_HOLD to BOOKED
        const sIndex = stalls.findIndex((s) => s.id === bookings[bIndex].stallId);
        if (sIndex !== -1) {
          stalls[sIndex] = {
            ...stalls[sIndex],
            status: 'BOOKED',
            bookedByUserId: bookings[bIndex].userId,
            bookedCompany: bookings[bIndex].companyName,
            currentHoldExpiresAt: undefined,
            heldByUserId: undefined,
          };
        }

        return res.json({
          received: true,
          status: 'PROCESSED',
          message: `Booking ${bookings[bIndex].bookingCode} transitioned to BOOKED via payment webhook.`,
          digitalQrPassGenerated: true,
        });
      }
    }

    return res.json({ received: true, status: 'IGNORED_OR_PENDING' });
  });

  // 10. GET /api/system/cloud-status - Cloud Infrastructure & Edge Deployment Metadata
  app.get('/api/system/cloud-status', (req: Request, res: Response) => {
    res.json({
      success: true,
      provider: 'Vercel Edge & AWS Serverless Cluster',
      region: 'us-east-1 / eu-west-1 Global Anycast',
      environment: process.env.NODE_ENV || 'production',
      concurrencyLocks: {
        engine: 'Redis MemoryCache Lock v7.2',
        defaultTTLSeconds: 600,
        activeHoldsCount: stalls.filter((s) => s.status === 'ON_HOLD').length,
      },
      dbConnectionPool: {
        type: 'Prisma Client + PostgreSQL (Cloud SQL)',
        activePoolSize: 15,
        idleTimeoutMs: 30000,
        status: 'HEALTHY_CONNECTED',
      },
      webhookGateway: {
        status: 'LISTENING',
        endpoint: '/api/webhooks/payment-gateway',
        retryAttemptsMax: 5,
      },
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  // 11. Networking & B2B Matchmaking Hub API Endpoints
  // GET /api/networking/attendees
  app.get('/api/networking/attendees', (req: Request, res: Response) => {
    const { role, industry, query } = req.query;
    let list = [...attendees];

    if (role) {
      list = list.filter((a) => a.role === String(role));
    }
    if (industry) {
      list = list.filter((a) => a.industry.toLowerCase().includes(String(industry).toLowerCase()));
    }
    if (query) {
      const q = String(query).toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.companyName.toLowerCase().includes(q) ||
          a.title.toLowerCase().includes(q) ||
          a.lookingFor.some((item) => item.toLowerCase().includes(q))
      );
    }

    res.json({ success: true, count: list.length, attendees: list });
  });

  // POST /api/networking/connections - Swap Digital Business Card
  app.post('/api/networking/connections', (req: Request, res: Response) => {
    const { targetAttendeeId, qrCodeData, notes } = req.body;

    let attendee = attendees.find((a) => a.id === targetAttendeeId || a.qrCodeData === qrCodeData);

    if (!attendee && qrCodeData) {
      // Create new connection from QR code payload
      attendee = {
        id: 'att-qr-' + Math.random().toString(36).substring(2, 6),
        name: 'Scanned Floor Attendee',
        title: 'Senior Executive',
        companyName: 'Verified Partner Co',
        industry: 'B2B Enterprise',
        email: 'scanned.contact@silvercrest-event.com',
        phone: '+1 (555) 900-[SCAN]',
        linkedin: 'https://linkedin.com/in/scanned-contact',
        bio: 'Met on exhibition floor via QR Code swap.',
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
        role: 'ATTENDEE',
        trustScore: 96,
        isVerified: true,
        qrCodeData: qrCodeData,
        lookingFor: ['Networking', 'Supplier Partnerships'],
      };
      attendees.push(attendee);
    }

    if (!attendee) {
      return res.status(404).json({ success: false, error: 'Attendee not found' });
    }

    const newConnection = {
      id: 'conn-' + Math.random().toString(36).substring(2, 8),
      attendeeId: attendee.id,
      attendee,
      connectedAt: new Date().toISOString(),
      notes: notes || 'Swapped business card on exhibition floor.',
    };

    savedConnections.push(newConnection);

    res.json({
      success: true,
      message: `Successfully connected with ${attendee.name} (${attendee.companyName})`,
      connection: newConnection,
    });
  });

  // GET /api/networking/connections - Get saved contacts
  app.get('/api/networking/connections', (req: Request, res: Response) => {
    const list = savedConnections.map((c) => ({
      ...c,
      attendee: attendees.find((a) => a.id === c.attendeeId),
    }));
    res.json({ success: true, count: list.length, connections: list });
  });

  // GET & POST /api/networking/messages - 1-on-1 Chat
  app.get('/api/networking/messages', (req: Request, res: Response) => {
    const { partnerId } = req.query;
    let list = [...chatMessages];
    if (partnerId) {
      list = list.filter(
        (m) =>
          (m.senderId === 'att-me' && m.receiverId === String(partnerId)) ||
          (m.senderId === String(partnerId) && m.receiverId === 'att-me')
      );
    }
    res.json({ success: true, count: list.length, messages: list });
  });

  app.post('/api/networking/messages', (req: Request, res: Response) => {
    const { receiverId, content, meetingRequest } = req.body;

    if (!receiverId || !content) {
      return res.status(400).json({ success: false, error: 'receiverId and content are required' });
    }

    const newMsg = {
      id: 'msg-' + Math.random().toString(36).substring(2, 8),
      senderId: 'att-me',
      receiverId,
      content,
      timestamp: new Date().toISOString(),
      meetingRequest: meetingRequest ? { ...meetingRequest, id: 'meet-' + Math.random().toString(36).substring(2, 6) } : undefined,
    };

    chatMessages.push(newMsg);

    res.json({ success: true, message: newMsg });
  });

  // --------------------------------------------------------------------------
  // VITE SERVING & PRODUCTION FALLBACK
  // --------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Silver Crest Connect] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
