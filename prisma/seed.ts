// ============================================================
// SmartTicketQR - Comprehensive Seed Data
// ============================================================
// Run: bun run prisma/seed.ts (via prisma db seed)
// ============================================================

import { PrismaClient } from '@prisma/client';
import { hashPassword, generateTicketCode } from '../src/lib/auth';
import { randomBytes } from 'crypto';

const db = new PrismaClient();

const ORG_SLUG = 'demo-transport';

async function main() {
  console.log('🌱 Seeding SmartTicketQR database...\n');

  // ── Clean existing data ─────────────────────────────────────
  console.log('🧹 Cleaning existing data...');
  await db.offlineScanQueue.deleteMany();
  await db.scanLog.deleteMany();
  await db.auditLog.deleteMany();
  await db.activityLog.deleteMany();
  await db.webhookLog.deleteMany();
  await db.scan.deleteMany();
  await db.transaction.deleteMany();
  await db.ticketItem.deleteMany();
  await db.ticket.deleteMany();
  await db.promoCode.deleteMany();
  await db.ticketExtra.deleteMany();
  await db.fareType.deleteMany();
  await db.lineSchedule.deleteMany();
  await db.transportLine.deleteMany();
  await db.event.deleteMany();
  await db.automationLog.deleteMany();
  await db.automationRule.deleteMany();
  await db.supportTicket.deleteMany();
  await db.fraudAlert.deleteMany();
  await db.affiliate.deleteMany();
  await db.customDomain.deleteMany();
  await db.webhookLog.deleteMany();
  await db.webhookEndpoint.deleteMany();
  await db.apiKey.deleteMany();
  await db.orgStatsCache.deleteMany();
  await db.orgSecret.deleteMany();
  await db.user.deleteMany();
  await db.subscription.deleteMany();
  await db.organization.deleteMany();
  console.log('✅ Cleaned.\n');

  // ── 1. Organization ─────────────────────────────────────────
  const org = await db.organization.create({
    data: {
      name: 'Transport Express Dakar',
      slug: ORG_SLUG,
      uuid: 'org-demo-001',
      primaryColor: '#059669',
      phone: '+221 33 800 00 00',
      email: 'contact@transportexpress.sn',
      subscriptionPlan: 'pro',
      subscriptionStatus: 'active',
      subscriptionExpiresAt: new Date('2026-12-31'),
      maxEvents: 50,
      maxTicketsPerEvent: 5000,
      maxUsers: 20,
      isActive: true,
      settings: JSON.stringify({
        currency: 'XOF',
        locale: 'fr',
        geoRadius: 5000,
      }),
    },
  });
  console.log(`🏢 Organization: ${org.name} (${org.id})`);

  // ── 2. Subscription Plan + Subscription ─────────────────────
  for (const plan of [
    { code: 'starter', name: 'Starter', priceMonthly: 0, currency: 'XOF', maxEvents: 5, maxTicketsPerEvent: 500, maxUsers: 3 },
    { code: 'pro', name: 'Pro', priceMonthly: 25000, currency: 'XOF', maxEvents: 50, maxTicketsPerEvent: 5000, maxUsers: 20 },
    { code: 'enterprise', name: 'Enterprise', priceMonthly: 75000, currency: 'XOF', maxEvents: 999, maxTicketsPerEvent: 99999, maxUsers: 100 },
  ]) {
    await db.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }

  await db.subscription.create({
    data: {
      organizationId: org.id,
      planCode: 'pro',
      amount: 25000,
      currency: 'XOF',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      status: 'active',
      paymentMethod: 'wave',
    },
  });
  console.log('💳 Subscription: Pro plan active');

  // ── 3. Users (4 roles) ──────────────────────────────────────
  const hashedPassword = await hashPassword('Demo@1234');

  const admin = await db.user.create({
    data: {
      email: 'admin@transportexpress.sn',
      name: 'Amadou Diallo',
      password: hashedPassword,
      role: 'admin',
      organizationId: org.id,
      isActive: true,
    },
  });

  const caisse = await db.user.create({
    data: {
      email: 'caisse@transportexpress.sn',
      name: 'Fatou Ndiaye',
      password: hashedPassword,
      role: 'caisse',
      organizationId: org.id,
      isActive: true,
    },
  });

  const controleur = await db.user.create({
    data: {
      email: 'controleur@transportexpress.sn',
      name: 'Ibrahima Fall',
      password: hashedPassword,
      role: 'controleur',
      organizationId: org.id,
      isActive: true,
    },
  });

  const comptable = await db.user.create({
    data: {
      email: 'comptable@transportexpress.sn',
      name: 'Aissatou Sy',
      password: hashedPassword,
      role: 'comptable',
      organizationId: org.id,
      isActive: true,
    },
  });
  console.log(`👥 Users: admin, caisse, controleur, comptable (4)`);

  // ── 4. Org Secret (HMAC for QR signing) ─────────────────────
  await db.orgSecret.create({
    data: {
      organizationId: org.id,
      hmacSecret: randomBytes(32).toString('hex'),
    },
  });
  console.log('🔑 Org HMAC secret created');

  // ── 5. Fare Types ───────────────────────────────────────────
  const fareTypes = await db.fareType.createMany({
    data: [
      {
        organizationId: org.id,
        slug: 'standard',
        name: 'Standard',
        emoji: '🎫',
        priceModifier: 1.0,
        requiresProof: false,
        proofLabel: '',
        maxScans: 1,
        maxPerBooking: 10,
        isActive: true,
      },
      {
        organizationId: org.id,
        slug: 'child',
        name: 'Enfant',
        emoji: '👦',
        priceModifier: 0.5,
        requiresProof: true,
        proofLabel: 'Âge vérifié sur place',
        ageMin: 0,
        ageMax: 12,
        maxScans: 1,
        maxPerBooking: 5,
        isActive: true,
      },
      {
        organizationId: org.id,
        slug: 'student',
        name: 'Étudiant',
        emoji: '🎓',
        priceModifier: 0.8,
        requiresProof: true,
        proofLabel: 'Numéro carte étudiant',
        ageMin: 16,
        ageMax: 28,
        maxScans: 1,
        maxPerBooking: 5,
        isActive: true,
      },
      {
        organizationId: org.id,
        slug: 'senior',
        name: 'Senior',
        emoji: '🧓',
        priceModifier: 0.7,
        requiresProof: true,
        proofLabel: 'Numéro pièce d\'identité',
        ageMin: 60,
        ageMax: null,
        maxScans: 1,
        maxPerBooking: 5,
        isActive: true,
      },
      {
        organizationId: org.id,
        slug: 'group',
        name: 'Groupe (10+)',
        emoji: '👥',
        priceModifier: 0.9,
        requiresProof: false,
        proofLabel: '',
        maxScans: 1,
        maxPerBooking: 50,
        isActive: true,
      },
      {
        organizationId: org.id,
        slug: 'round_trip',
        name: 'Aller-Retour',
        emoji: '🔄',
        priceModifier: 1.8,
        requiresProof: false,
        proofLabel: '',
        maxScans: 2,
        maxPerBooking: 10,
        isActive: true,
      },
    ],
  });
  console.log('🏷️ Fare Types: 6 created (Standard, Enfant, Étudiant, Senior, Groupe, Aller-Retour)');

  // ── 6. Ticket Extras ────────────────────────────────────────
  await db.ticketExtra.createMany({
    data: [
      {
        organizationId: org.id,
        slug: 'bagage_sup',
        name: 'Bagage supplémentaire',
        emoji: '🧳',
        pricingType: 'fixed',
        basePrice: 2000,
        requiresDetails: false,
        detailLabel: '',
        maxPerTicket: 3,
        isActive: true,
      },
      {
        organizationId: org.id,
        slug: 'velo_moto',
        name: 'Vélo / Moto',
        emoji: '🚲',
        pricingType: 'fixed',
        basePrice: 3000,
        requiresDetails: false,
        detailLabel: '',
        maxPerTicket: 1,
        isActive: true,
      },
      {
        organizationId: org.id,
        slug: 'animal',
        name: 'Animal de compagnie',
        emoji: '🐕',
        pricingType: 'fixed',
        basePrice: 1500,
        requiresDetails: true,
        detailLabel: 'Type d\'animal',
        maxPerTicket: 2,
        isActive: true,
      },
      {
        organizationId: org.id,
        slug: 'voiture',
        name: 'Place véhicule',
        emoji: '🚗',
        pricingType: 'fixed',
        basePrice: 10000,
        requiresDetails: true,
        detailLabel: 'Plaque d\'immatriculation',
        maxPerTicket: 1,
        isActive: true,
      },
      {
        organizationId: org.id,
        slug: 'climatisation',
        name: 'Climatisation',
        emoji: '❄️',
        pricingType: 'fixed',
        basePrice: 500,
        requiresDetails: false,
        detailLabel: '',
        maxPerTicket: 1,
        isActive: true,
      },
    ],
  });
  console.log('📦 Ticket Extras: 5 created (Bagage, Vélo, Animal, Voiture, Clim)');

  // ── 7. Promo Codes ──────────────────────────────────────────
  await db.promoCode.createMany({
    data: [
      {
        organizationId: org.id,
        code: 'NOEL2025',
        type: 'percent',
        value: 15,
        minTickets: 1,
        validFrom: new Date('2025-12-01'),
        validUntil: new Date('2025-12-31'),
        maxUses: 100,
        usedCount: 0,
        isActive: true,
      },
      {
        organizationId: org.id,
        code: 'GROUPE10',
        type: 'fixed',
        value: 1000,
        minTickets: 1,
        validFrom: new Date('2025-01-01'),
        validUntil: new Date('2026-06-30'),
        maxUses: 500,
        usedCount: 3,
        isActive: true,
      },
      {
        organizationId: org.id,
        code: 'ETUDIANT25',
        type: 'percent',
        value: 25,
        minTickets: 1,
        validFrom: new Date('2025-09-01'),
        validUntil: new Date('2026-06-30'),
        maxUses: 200,
        usedCount: 12,
        isActive: true,
      },
    ],
  });
  console.log('🏷️ Promo Codes: 3 created (NOEL2025, GROUPE10, ETUDIANT25)');

  // ── 8. Transport Lines ──────────────────────────────────────
  await db.transportLine.createMany({
    data: [
      {
        organizationId: org.id,
        name: 'Dakar → Thiès',
        origin: 'Dakar',
        destination: 'Thiès',
        vehicleType: 'bus',
        color: '#059669',
        isActive: true,
      },
      {
        organizationId: org.id,
        name: 'Dakar → Saint-Louis',
        origin: 'Dakar',
        destination: 'Saint-Louis',
        vehicleType: 'bus',
        color: '#d97706',
        isActive: true,
      },
      {
        organizationId: org.id,
        name: 'Dakar → Ziguinchor (Ferry)',
        origin: 'Dakar',
        destination: 'Ziguinchor',
        vehicleType: 'ferry',
        color: '#0891b2',
        isActive: true,
      },
    ],
  });

  // Create schedules for Dakar → Thiès
  const dakarThies = await db.transportLine.findFirst({ where: { organizationId: org.id, slug: undefined, origin: 'Dakar', destination: 'Thiès' } });
  if (dakarThies) {
    await db.lineSchedule.createMany({
      data: [
        { lineId: dakarThies.id, type: 'departure', time: '06:00', status: 'on_time' },
        { lineId: dakarThies.id, type: 'departure', time: '08:30', status: 'on_time' },
        { lineId: dakarThies.id, type: 'departure', time: '11:00', status: 'on_time' },
        { lineId: dakarThies.id, type: 'departure', time: '14:00', status: 'on_time' },
        { lineId: dakarThies.id, type: 'departure', time: '17:30', status: 'on_time' },
        { lineId: dakarThies.id, type: 'arrival', time: '07:30', status: 'on_time' },
        { lineId: dakarThies.id, type: 'arrival', time: '10:00', status: 'on_time' },
        { lineId: dakarThies.id, type: 'arrival', time: '12:30', status: 'on_time' },
        { lineId: dakarThies.id, type: 'arrival', time: '15:30', status: 'on_time' },
        { lineId: dakarThies.id, type: 'arrival', time: '19:00', status: 'on_time' },
      ],
    });
  }
  console.log('🚌 Transport Lines: 3 created with schedules');

  // ── 9. Events ───────────────────────────────────────────────
  const now = new Date();
  const events = await db.event.createMany({
    data: [
      {
        name: 'Dakar → Thiès (Quotidien)',
        type: 'transport',
        description: 'Trajet régulier Dakar - Thiès, climatisé',
        location: 'Gare Routière de Dakar',
        latitude: 14.6937,
        longitude: -17.4441,
        startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0),
        endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59),
        totalTickets: 500,
        soldTickets: 0,
        price: 5000,
        currency: 'XOF',
        status: 'active',
        userId: admin.id,
        organizationId: org.id,
      },
      {
        name: 'Dakar → Saint-Louis (Express)',
        type: 'transport',
        description: 'Trajet express Dakar - Saint-Louis',
        location: 'Gare Routière de Dakar',
        latitude: 14.6937,
        longitude: -17.4441,
        startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 30),
        endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59),
        totalTickets: 200,
        soldTickets: 0,
        price: 15000,
        currency: 'XOF',
        status: 'active',
        userId: admin.id,
        organizationId: org.id,
      },
      {
        name: 'Ferry Dakar → Ziguinchor',
        type: 'transport',
        description: 'Traversée maritime Dakar - Ziguinchor',
        location: 'Port de Dakar',
        latitude: 14.6973,
        longitude: -17.4397,
        startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 8, 0),
        endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 18, 0),
        totalTickets: 300,
        soldTickets: 0,
        price: 35000,
        currency: 'XOF',
        status: 'active',
        userId: admin.id,
        organizationId: org.id,
      },
    ],
  });
  console.log('🎫 Events: 3 created (Dakar→Thiès, Dakar→St-Louis, Ferry)');

  // ── 10. Sample Tickets ──────────────────────────────────────
  const createdEvents = await db.event.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true, price: true },
  });

  if (createdEvents.length > 0) {
    const event1 = createdEvents[0]; // Dakar → Thiès
    const event2 = createdEvents[1]; // Dakar → Saint-Louis

    const fareTypeRecords = await db.fareType.findMany({
      where: { organizationId: org.id },
      select: { id: true, slug: true, priceModifier: true, maxScans: true },
    });

    const standardFare = fareTypeRecords.find(f => f.slug === 'standard');
    const studentFare = fareTypeRecords.find(f => f.slug === 'student');
    const roundTripFare = fareTypeRecords.find(f => f.slug === 'round_trip');
    const childFare = fareTypeRecords.find(f => f.slug === 'child');

    const extraRecords = await db.ticketExtra.findMany({
      where: { organizationId: org.id },
      select: { id: true, slug: true, basePrice: true },
    });

    const bagageExtra = extraRecords.find(e => e.slug === 'bagage_sup');
    const animalExtra = extraRecords.find(e => e.slug === 'animal');

    // Ticket 1: Standard ticket for Dakar → Thiès
    await createTicket({
      eventId: event1.id, userId: caisse.id, orgId: org.id,
      fareTypeId: standardFare?.id, fareName: 'Standard',
      basePrice: event1.price, modifier: 1.0, extrasTotal: 0, discount: 0,
      maxScans: 1, holderName: 'Moussa Sow', holderEmail: 'moussa@email.com',
      holderPhone: '+221 77 111 22 33',
    });

    // Ticket 2: Student ticket with ID proof (Dakar → Thiès)
    await createTicket({
      eventId: event1.id, userId: caisse.id, orgId: org.id,
      fareTypeId: studentFare?.id, fareName: 'Étudiant',
      basePrice: event1.price, modifier: 0.8, extrasTotal: 0, discount: 0,
      maxScans: 1, holderName: 'Awa Diop', holderEmail: 'awa.etudiant@email.com',
      idProofNumber: 'ETU-2024-00456',
    });

    // Ticket 3: Round-trip ticket (Dakar → Saint-Louis)
    await createTicket({
      eventId: event2.id, userId: caisse.id, orgId: org.id,
      fareTypeId: roundTripFare?.id, fareName: 'Aller-Retour',
      basePrice: event2.price, modifier: 1.8, extrasTotal: 0, discount: 0,
      maxScans: 2, holderName: 'Ousmane Ba', holderEmail: 'ousmane@email.com',
      holderPhone: '+221 76 444 55 66',
    });

    // Ticket 4: Child ticket with bagage extra (Dakar → Thiès)
    const ticket4 = await createTicket({
      eventId: event1.id, userId: caisse.id, orgId: org.id,
      fareTypeId: childFare?.id, fareName: 'Enfant',
      basePrice: event1.price, modifier: 0.5, extrasTotal: 2000, discount: 0,
      maxScans: 1, holderName: 'Mariam Diallo', holderEmail: 'mariam@email.com',
      idProofNumber: 'AGE-08',
    });
    if (ticket4 && bagageExtra) {
      await db.ticketItem.create({
        data: {
          ticketId: ticket4.id,
          extraId: bagageExtra.id,
          quantity: 1,
          unitPrice: 2000,
          details: '',
        },
      });
    }

    // Ticket 5: Vehicle ticket (Dakar → Saint-Louis)
    const voitureExtra = extraRecords.find(e => e.slug === 'voiture');
    const ticket5 = await createTicket({
      eventId: event2.id, userId: caisse.id, orgId: org.id,
      fareTypeId: standardFare?.id, fareName: 'Standard + Véhicule',
      basePrice: event2.price, modifier: 1.0, extrasTotal: 10000, discount: 0,
      maxScans: 1, holderName: 'Cheikh Anta Mbaye', holderEmail: 'cheikh@email.com',
      vehiclePlate: 'DK-4521-AB', vehicleType: 'berline',
    });
    if (ticket5 && voitureExtra) {
      await db.ticketItem.create({
        data: {
          ticketId: ticket5.id,
          extraId: voitureExtra.id,
          quantity: 1,
          unitPrice: 10000,
          details: '{"plate":"DK-4521-AB"}',
        },
      });
    }

    console.log('🎫 Sample Tickets: 5 created (Standard, Student, Round-trip, Child+Bagage, Vehicle)');
  }

  // ── 11. Org Stats Cache ─────────────────────────────────────
  await db.orgStatsCache.create({
    data: {
      organizationId: org.id,
      totalRevenueMonth: 250000,
      totalTicketsSoldMonth: 156,
      totalScansToday: 23,
      totalScansWeek: 145,
      totalTicketsAll: 2847,
      totalActiveEvents: 3,
      validationRate: 94.2,
    },
  });
  console.log('📊 Stats cache initialized');

  console.log('\n✅ Seed completed successfully!');
  console.log('\n🔐 Login credentials:');
  console.log('   Admin:      admin@transportexpress.sn / Demo@1234');
  console.log('   Caisse:     caisse@transportexpress.sn / Demo@1234');
  console.log('   Contrôleur: controleur@transportexpress.sn / Demo@1234');
  console.log('   Comptable:  comptable@transportexpress.sn / Demo@1234');
  console.log('   Org Slug:    ' + ORG_SLUG);
}

async function createTicket(params: {
  eventId: string;
  userId: string;
  orgId: string;
  fareTypeId?: string;
  fareName: string;
  basePrice: number;
  modifier: number;
  extrasTotal: number;
  discount: number;
  maxScans: number;
  holderName: string;
  holderEmail: string;
  holderPhone?: string;
  idProofNumber?: string;
  vehiclePlate?: string;
  vehicleType?: string;
}) {
  const event = await db.event.findUnique({ where: { id: params.eventId } });
  if (!event) return null;

  const modifiedPrice = Math.round(params.basePrice * params.modifier * 100) / 100;
  const subtotal = modifiedPrice + params.extrasTotal;
  const total = Math.max(0, Math.round((subtotal - params.discount) * 100) / 100);

  const ticket = await db.ticket.create({
    data: {
      eventId: params.eventId,
      userId: params.userId,
      ticketCode: generateTicketCode(),
      ticketType: params.fareName,
      holderName: params.holderName,
      holderEmail: params.holderEmail,
      holderPhone: params.holderPhone || null,
      price: total,
      currency: 'XOF',
      status: 'active',
      expiresAt: event.endDate,
      fareTypeId: params.fareTypeId || null,
      basePrice: params.basePrice,
      extrasTotal: params.extrasTotal,
      discountAmount: params.discount,
      maxScans: params.maxScans,
      usageCount: 0,
      idProofNumber: params.idProofNumber || null,
      vehiclePlate: params.vehiclePlate || null,
      vehicleType: params.vehicleType || null,
    },
  });

  await db.event.update({
    where: { id: params.eventId },
    data: { soldTickets: { increment: 1 } },
  });

  await db.transaction.create({
    data: {
      eventId: params.eventId,
      ticketId: ticket.id,
      userId: params.userId,
      organizationId: params.orgId,
      amount: total,
      currency: 'XOF',
      status: 'completed',
      paymentMethod: 'cash',
      description: `Ticket: ${params.fareName} - ${ticket.ticketCode}`,
    },
  });

  return ticket;
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
