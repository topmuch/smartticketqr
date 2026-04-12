import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, generateTicketCode } from '@/lib/auth';
import { corsResponse, withErrorHandler, handleCors } from '@/lib/api-helper';
import { getOrgSecret } from '@/lib/ticket-generator';

/**
 * Seed demo data for a default organization.
 * Creates: 1 organization, 3 users, 6 events, ~300 tickets, scans, transactions, activity logs.
 *
 * ⚠️ SECURITY: This endpoint is DISABLED in production.
 *    In development, it allows seeding demo data without authentication.
 */
export async function POST(request: NextRequest) {
  // ─── Security gate: block in production ───
  if (process.env.NODE_ENV === 'production') {
    return corsResponse({ error: 'Seed endpoint is disabled in production' }, 403);
  }

  return withErrorHandler(async () => {
    // Check if demo organization already exists
    const existingOrg = await db.organization.findFirst({ where: { slug: 'demo' } });
    if (existingOrg) {
      const userCount = await db.user.count({ where: { organizationId: existingOrg.id } });
      const eventCount = await db.event.count({ where: { organizationId: existingOrg.id } });
      if (userCount > 0) {
        return corsResponse({
          message: 'Demo data already exists',
          organization: { id: existingOrg.id, name: existingOrg.name, slug: existingOrg.slug },
          stats: { users: userCount, events: eventCount },
        });
      }
    }

    // Create subscription plans
    await db.subscriptionPlan.upsert({
      where: { code: 'starter' },
      update: {},
      create: {
        code: 'starter',
        name: 'Starter',
        priceMonthly: 5000,
        currency: 'XOF',
        maxEvents: 5,
        maxTicketsPerEvent: 500,
        maxUsers: 3,
        maxTicketsMonth: 2000,
        features: JSON.stringify(['Basic QR scanning', 'Email support', '5 events/month', '500 tickets/event']),
        isActive: true,
        sortOrder: 1,
      },
    });

    await db.subscriptionPlan.upsert({
      where: { code: 'pro' },
      update: {},
      create: {
        code: 'pro',
        name: 'Pro',
        priceMonthly: 25000,
        currency: 'XOF',
        maxEvents: 50,
        maxTicketsPerEvent: 5000,
        maxUsers: 20,
        maxTicketsMonth: 20000,
        features: JSON.stringify(['Advanced analytics', 'Priority support', '50 events/month', '5000 tickets/event', 'Bulk QR generation', 'CSV export']),
        isActive: true,
        sortOrder: 2,
      },
    });

    await db.subscriptionPlan.upsert({
      where: { code: 'enterprise' },
      update: {},
      create: {
        code: 'enterprise',
        name: 'Enterprise',
        priceMonthly: 99000,
        currency: 'XOF',
        maxEvents: 999999,
        maxTicketsPerEvent: 100000,
        maxUsers: 999999,
        maxTicketsMonth: 0,
        features: JSON.stringify(['Unlimited events', 'Unlimited tickets', 'Unlimited users', 'Dedicated support', 'Custom branding', 'API access', 'Webhooks', 'Multi-org']),
        isActive: true,
        sortOrder: 3,
      },
    });

    // Create default organization
    const org = await db.organization.create({
      data: {
        uuid: crypto.randomUUID(),
        name: 'SmartTicketQR Demo',
        slug: 'demo',
        primaryColor: '#059669',
        subscriptionPlan: 'enterprise',
        subscriptionStatus: 'active',
        maxEvents: 999999,
        maxTicketsPerEvent: 100000,
        maxUsers: 999999,
        subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      },
    });

    // Create active subscription record for the demo org
    await db.subscription.create({
      data: {
        organizationId: org.id,
        planCode: 'enterprise',
        amount: 99000,
        currency: 'XOF',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: 'active',
        paymentMethod: 'manual',
        externalRef: 'DEMO-SEED-ENTERPRISE',
      },
    });

    const orgId = org.id;

    // Ensure HMAC secret for QR signing (Phase 3)
    await getOrgSecret(orgId);

    const hashedPassword = await hashPassword('Admin@123');

    // Create users
    const superAdmin = await db.user.create({
      data: {
        name: 'Super Administrator',
        email: 'admin@smartticketqr.com',
        password: hashedPassword,
        role: 'super_admin',
        organizationId: orgId,
      },
    });

    const admin = await db.user.create({
      data: {
        name: 'John Administrateur',
        email: 'john@smartticketqr.com',
        password: hashedPassword,
        role: 'admin',
        organizationId: orgId,
      },
    });

    const caisse = await db.user.create({
      data: {
        name: 'Aminata Caisse',
        email: 'aminata@smartticketqr.com',
        password: hashedPassword,
        role: 'caisse',
        organizationId: orgId,
      },
    });

    const controleur = await db.user.create({
      data: {
        name: 'Ibrahima Controleur',
        email: 'ibrahima@smartticketqr.com',
        password: hashedPassword,
        role: 'controleur',
        organizationId: orgId,
      },
    });

    const comptable = await db.user.create({
      data: {
        name: 'Fatou Comptable',
        email: 'fatou@smartticketqr.com',
        password: hashedPassword,
        role: 'comptable',
        organizationId: orgId,
      },
    });

    // Create events
    const eventsData = [
      {
        name: 'Summer Music Festival 2025',
        type: 'event',
        description: 'The biggest outdoor music festival featuring international artists and local talents. Three days of non-stop music, food, and entertainment.',
        location: 'Central Park Arena, Dakar',
        startDate: new Date('2025-08-15T10:00:00Z'),
        endDate: new Date('2025-08-17T22:00:00Z'),
        totalTickets: 5000,
        soldTickets: 3200,
        price: 50,
        currency: 'USD',
        status: 'active',
        userId: superAdmin.id,
        image: '/images/music-festival.jpg',
        organizationId: orgId,
      },
      {
        name: 'Tech Conference Senegal',
        type: 'event',
        description: 'Annual technology conference bringing together innovators, developers, and entrepreneurs from across West Africa.',
        location: 'Diamniadio Conference Center',
        startDate: new Date('2025-09-20T08:00:00Z'),
        endDate: new Date('2025-09-22T18:00:00Z'),
        totalTickets: 1000,
        soldTickets: 650,
        price: 120,
        currency: 'USD',
        status: 'active',
        userId: admin.id,
        image: '/images/tech-conference.jpg',
        organizationId: orgId,
      },
      {
        name: 'Dakar → Saint-Louis Express',
        type: 'bus',
        description: 'Express bus service from Dakar to Saint-Louis with air conditioning and Wi-Fi.',
        location: 'Dakar Bus Terminal',
        startDate: new Date('2025-07-01T06:00:00Z'),
        endDate: new Date('2025-07-01T10:00:00Z'),
        totalTickets: 45,
        soldTickets: 38,
        price: 15,
        currency: 'USD',
        status: 'active',
        userId: admin.id,
        image: '/images/bus-express.jpg',
        organizationId: orgId,
      },
      {
        name: 'Gorée Island Ferry',
        type: 'ferry',
        description: 'Round-trip ferry service to the historic Gorée Island. Departures every hour from the main port.',
        location: 'Dakar Port',
        startDate: new Date('2025-07-01T07:00:00Z'),
        endDate: new Date('2025-07-01T18:00:00Z'),
        totalTickets: 200,
        soldTickets: 150,
        price: 10,
        currency: 'USD',
        status: 'active',
        userId: controleur.id,
        image: '/images/ferry-goree.jpg',
        organizationId: orgId,
      },
      {
        name: 'Casamance River Cruise',
        type: 'boat',
        description: 'Scenic boat tour through the beautiful Casamance river with stops at traditional villages.',
        location: 'Ziguinchor Port',
        startDate: new Date('2025-07-15T09:00:00Z'),
        endDate: new Date('2025-07-15T17:00:00Z'),
        totalTickets: 30,
        soldTickets: 22,
        price: 75,
        currency: 'USD',
        status: 'active',
        userId: superAdmin.id,
        image: '/images/river-cruise.jpg',
        organizationId: orgId,
      },
      {
        name: 'National Day Celebration',
        type: 'event',
        description: 'Grand celebration for Independence Day with parade, fireworks, and cultural performances.',
        location: 'Place de la Nation, Dakar',
        startDate: new Date('2025-04-04T08:00:00Z'),
        endDate: new Date('2025-04-04T23:00:00Z'),
        totalTickets: 10000,
        soldTickets: 8500,
        price: 5,
        currency: 'USD',
        status: 'completed',
        userId: superAdmin.id,
        image: '/images/national-day.jpg',
        organizationId: orgId,
      },
    ];

    await db.event.createMany({ data: eventsData });
    const allEvents = await db.event.findMany({ where: { organizationId: orgId } });

    // Create tickets
    const ticketTypes = ['VIP', 'Standard', 'Standard', 'Standard', 'Economy'];
    const firstNames = ['Amadou', 'Fatou', 'Moussa', 'Aissatou', 'Ibrahima', 'Mariama', 'Ousmane', 'Kine', 'Mamadou', 'Adama', 'Cheikh', 'Djibril', 'Awa', 'Lamine', 'Sokhna', 'Boubacar', 'Ndeye', 'Pape', 'Coumba', 'Abdoulaye', 'Rama', 'Babacar', 'Thierno', 'Khady', 'Seydou', 'Oumou', 'Moustapha', 'Aminata', 'Idrissa', 'Bineta'];
    const lastNames = ['Diallo', 'Ndiaye', 'Ba', 'Fall', 'Sow', 'Diop', 'Sy', 'Mbaye', 'Kane', 'Gueye', 'Sarr', 'Dia', 'Cisse', 'Thiam', 'Dieng', 'Toure', 'Wane', 'Niang', 'Seck', 'Lo'];

    const ticketsToCreate: Array<{
      eventId: string;
      userId: string;
      ticketCode: string;
      ticketType: string;
      holderName: string;
      holderEmail: string;
      holderPhone: string;
      seatNumber: string | undefined;
      price: number;
      currency: string;
      status: string;
      validatedAt?: Date;
      issuedAt: Date;
    }> = [];

    for (const event of allEvents) {
      const ticketCount = Math.min(50, event.soldTickets);
      const users = [superAdmin, admin, caisse, controleur, comptable];

      for (let i = 0; i < ticketCount; i++) {
        const firstName = firstNames[i % firstNames.length];
        const lastName = lastNames[i % lastNames.length];
        const holderName = `${firstName} ${lastName}`;
        const holderEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`;
        const ticketType = ticketTypes[i % ticketTypes.length];
        const status = event.status === 'completed'
          ? (i < 35 ? 'used' : i < 45 ? 'expired' : 'active')
          : (i < 15 ? 'used' : 'active');

        const priceMultiplier = ticketType === 'VIP' ? 2 : ticketType === 'Economy' ? 0.7 : 1;

        ticketsToCreate.push({
          eventId: event.id,
          userId: users[i % 3].id,
          ticketCode: generateTicketCode(),
          ticketType,
          holderName,
          holderEmail,
          holderPhone: `+221 7${Math.floor(1000000 + Math.random() * 9000000)}`,
          seatNumber: event.type === 'event' ? undefined : `${String.fromCharCode(65 + Math.floor(i / 5))}${(i % 5) + 1}`,
          price: Math.round(event.price * priceMultiplier * 100) / 100,
          currency: event.currency,
          status,
          validatedAt: status === 'used' ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) : undefined,
          issuedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        });
      }
    }

    await db.ticket.createMany({ data: ticketsToCreate });
    const allTickets = await db.ticket.findMany({
      include: { event: { select: { id: true, organizationId: true } } },
    });

    // Create scans for used tickets
    const scansToCreate = allTickets
      .filter(t => t.status === 'used')
      .map(ticket => ({
        ticketId: ticket.id,
        eventId: ticket.eventId,
        scannedBy: controleur.id,
        organizationId: ticket.event.organizationId,
        result: 'valid' as const,
        deviceInfo: 'Mobile Scanner v2.1',
        location: 'Main Entrance',
        createdAt: ticket.validatedAt || new Date(),
      }));

    await db.scan.createMany({ data: scansToCreate });

    // Create some invalid scans
    const invalidTickets = allTickets.filter(t => t.status === 'active').slice(0, 3);
    await db.scan.createMany({
      data: invalidTickets.map(t => ({
        ticketId: t.id,
        eventId: t.eventId,
        scannedBy: controleur.id,
        organizationId: t.event.organizationId,
        result: 'already_used' as const,
        deviceInfo: 'Mobile Scanner v2.1',
        location: 'Gate B',
      })),
    });

    // Create transactions
    const completedTickets = allTickets.filter(t => t.status !== 'cancelled');
    const transactionsToCreate = completedTickets.map(ticket => ({
      eventId: ticket.eventId,
      ticketId: ticket.id,
      userId: ticket.userId,
      organizationId: ticket.event.organizationId,
      amount: ticket.price,
      currency: ticket.currency,
      status: 'completed' as const,
      paymentMethod: (['cash', 'wave', 'orange_money', 'stripe'] as const)[Math.floor(Math.random() * 4)],
      description: `Ticket: ${ticket.ticketType} - ${ticket.ticketCode}`,
      createdAt: ticket.issuedAt,
    }));

    await db.transaction.createMany({ data: transactionsToCreate });

    // Create activity logs
    const activityLogs = [
      { userId: superAdmin.id, organizationId: orgId, action: 'event.create', details: 'Created Summer Music Festival 2025' },
      { userId: superAdmin.id, organizationId: orgId, action: 'event.create', details: 'Created Casamance River Cruise' },
      { userId: superAdmin.id, organizationId: orgId, action: 'user.register', details: 'Super admin account created' },
      { userId: admin.id, organizationId: orgId, action: 'event.create', details: 'Created Tech Conference Senegal' },
      { userId: admin.id, organizationId: orgId, action: 'ticket.create', details: 'Bulk generated 50 tickets for Tech Conference' },
      { userId: controleur.id, organizationId: orgId, action: 'scan.validate', details: 'Validated 15 tickets at Main Entrance' },
      { userId: controleur.id, organizationId: orgId, action: 'scan.validate', details: 'Rejected 3 already-used tickets' },
      { userId: superAdmin.id, organizationId: orgId, action: 'system.seed', details: 'Database seeded with demo data' },
      { userId: admin.id, organizationId: orgId, action: 'report.export', details: 'Exported ticket report for Music Festival' },
      { userId: controleur.id, organizationId: orgId, action: 'ticket.validate', details: 'Validated 20 tickets for ferry service' },
    ];

    await db.activityLog.createMany({ data: activityLogs });

    // ─── Seed Fare Types ───────────────────────────────────────────
    const fareTypesData = [
      { organizationId: orgId, slug: 'standard', name: 'Standard', emoji: '🎫', priceModifier: 1.0, requiresProof: false, proofLabel: '', ageMin: null, ageMax: null, maxPerBooking: 50, isActive: true },
      { organizationId: orgId, slug: 'child', name: 'Enfant', emoji: '👶', priceModifier: 0.50, requiresProof: false, proofLabel: '', ageMin: 0, ageMax: 12, maxPerBooking: 10, isActive: true },
      { organizationId: orgId, slug: 'student', name: 'Étudiant', emoji: '🎓', priceModifier: 0.80, requiresProof: true, proofLabel: 'Carte étudiant', ageMin: 15, ageMax: 28, maxPerBooking: 10, isActive: true },
      { organizationId: orgId, slug: 'senior', name: 'Senior', emoji: '🧓', priceModifier: 0.60, requiresProof: true, proofLabel: "Pièce d'identité", ageMin: 60, ageMax: null, maxPerBooking: 10, isActive: true },
      { organizationId: orgId, slug: 'group', name: 'Groupe (5+)', emoji: '👥', priceModifier: 0.85, requiresProof: false, proofLabel: '', ageMin: null, ageMax: null, maxPerBooking: 50, isActive: true },
      { organizationId: orgId, slug: 'round_trip', name: 'Aller-Retour', emoji: '🔄', priceModifier: 2.0, requiresProof: false, proofLabel: '', ageMin: null, ageMax: null, maxPerBooking: 10, isActive: true },
    ];
    await db.fareType.createMany({ data: fareTypesData });

    // ─── Seed Ticket Extras ────────────────────────────────────────
    const extrasData = [
      { organizationId: orgId, slug: 'bagage_sup', name: 'Bagage supplémentaire', emoji: '🧳', pricingType: 'per_unit', basePrice: 500, requiresDetails: false, detailLabel: '', maxPerTicket: 3, isActive: true },
      { organizationId: orgId, slug: 'velo', name: 'Vélo / Moto', emoji: '🚲', pricingType: 'fixed', basePrice: 1000, requiresDetails: true, detailLabel: "Type (vélo/moto)", maxPerTicket: 1, isActive: true },
      { organizationId: orgId, slug: 'animal', name: 'Animal de compagnie', emoji: '🐕', pricingType: 'fixed', basePrice: 500, requiresDetails: true, detailLabel: "Type d'animal", maxPerTicket: 2, isActive: true },
      { organizationId: orgId, slug: 'voiture', name: 'Voiture', emoji: '🚗', pricingType: 'fixed', basePrice: 15000, requiresDetails: true, detailLabel: 'Plaque immatriculation', maxPerTicket: 1, isActive: true },
    ];
    await db.ticketExtra.createMany({ data: extrasData });

    // ─── Seed Promo Codes ──────────────────────────────────────────
    const promosData = [
      { organizationId: orgId, code: 'BIENVENUE10', type: 'percent', value: 10, minTickets: 1, validFrom: new Date(), validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), maxUses: 100, isActive: true },
      { organizationId: orgId, code: 'GROUPE15', type: 'percent', value: 15, minTickets: 5, validFrom: new Date(), validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), maxUses: 50, isActive: true },
      { organizationId: orgId, code: 'FIDELITE500', type: 'fixed', value: 500, minTickets: 1, validFrom: new Date(), validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), maxUses: 200, isActive: true },
      { organizationId: orgId, code: 'NOEL2025', type: 'percent', value: 20, minTickets: 1, validFrom: new Date('2025-12-01'), validUntil: new Date('2025-12-31'), maxUses: 500, isActive: true },
    ];
    await db.promoCode.createMany({ data: promosData });

    return corsResponse({
      message: 'Demo data seeded successfully',
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        subscriptionPlan: org.subscriptionPlan,
      },
      stats: {
        users: 5,
        events: allEvents.length,
        tickets: ticketsToCreate.length,
        scans: scansToCreate.length + invalidTickets.length,
        transactions: transactionsToCreate.length,
        activityLogs: activityLogs.length,
      },
    }, 201);
  });
}

export async function OPTIONS() { return handleCors(); }
