import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, generateTicketCode } from '@/lib/auth';
import { corsResponse, withErrorHandler } from '@/lib/api-helper';

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    // Check if super_admin already exists
    const existingAdmin = await db.user.findFirst({ where: { role: 'super_admin' } });
    if (existingAdmin) {
      return corsResponse({ message: 'Super admin already exists', user: { id: existingAdmin.id, email: existingAdmin.email, role: existingAdmin.role } });
    }

    const hashedPassword = await hashPassword('Admin@123');

    // Create super admin
    const superAdmin = await db.user.create({
      data: {
        name: 'Super Administrator',
        email: 'admin@smartticketqr.com',
        password: hashedPassword,
        role: 'super_admin',
      },
    });

    // Create additional users
    const admin = await db.user.create({
      data: {
        name: 'John Manager',
        email: 'john@smartticketqr.com',
        password: hashedPassword,
        role: 'admin',
      },
    });

    const operator = await db.user.create({
      data: {
        name: 'Sarah Operator',
        email: 'sarah@smartticketqr.com',
        password: hashedPassword,
        role: 'operator',
      },
    });

    // Create events
    const events = [
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
        userId: operator.id,
        image: '/images/ferry-goree.jpg',
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
      },
    ];

    const createdEvents = await db.event.createMany({ data: events });
    const allEvents = await db.event.findMany();

    // Create tickets for each event
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
      seatNumber: string;
      price: number;
      currency: string;
      status: string;
      validatedAt?: Date;
      issuedAt: Date;
    }> = [];

    for (const event of allEvents) {
      const ticketCount = Math.min(50, event.soldTickets);
      const users = [superAdmin, admin, operator];

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
    const allTickets = await db.ticket.findMany();

    // Create scans for used tickets
    const scansToCreate = allTickets
      .filter(t => t.status === 'used')
      .map(ticket => ({
        ticketId: ticket.id,
        eventId: ticket.eventId,
        scannedBy: operator.id,
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
        scannedBy: operator.id,
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
      { userId: superAdmin.id, action: 'event.create', details: 'Created Summer Music Festival 2025' },
      { userId: superAdmin.id, action: 'event.create', details: 'Created Casamance River Cruise' },
      { userId: superAdmin.id, action: 'user.register', details: 'Super admin account created' },
      { userId: admin.id, action: 'event.create', details: 'Created Tech Conference Senegal' },
      { userId: admin.id, action: 'ticket.create', details: 'Bulk generated 50 tickets for Tech Conference' },
      { userId: operator.id, action: 'scan.validate', details: 'Validated 15 tickets at Main Entrance' },
      { userId: operator.id, action: 'scan.validate', details: 'Rejected 3 already-used tickets' },
      { userId: superAdmin.id, action: 'system.seed', details: 'Database seeded with demo data' },
      { userId: admin.id, action: 'report.export', details: 'Exported ticket report for Music Festival' },
      { userId: operator.id, action: 'ticket.validate', details: 'Validated 20 tickets for ferry service' },
    ];

    await db.activityLog.createMany({ data: activityLogs });

    return corsResponse({
      message: 'Demo data seeded successfully',
      stats: {
        users: 3,
        events: allEvents.length,
        tickets: ticketsToCreate.length,
        scans: scansToCreate.length + invalidTickets.length,
        transactions: transactionsToCreate.length,
        activityLogs: activityLogs.length,
      },
    }, 201);
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
}
