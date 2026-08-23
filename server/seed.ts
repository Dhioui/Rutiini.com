import { db } from './db';
import { municipalities, daycares, users, children, guardians, entries, trips, tripResponses } from '@shared/schema';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Seeding database...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // The login screen asks for a municipality before a daycare, so seeding daycares
  // without one left the picker empty and made the seeded data unusable.
  const [municipality] = await db.insert(municipalities).values({
    name: 'Helsinki',
    code: 'HEL',
  }).returning();

  console.log(`✅ Created municipality: ${municipality.name} (${municipality.code})`);

  // Create two daycares
  const [daycare1] = await db.insert(daycares).values({
    name: 'Aurinko Päiväkoti',
    code: 'aurinko',
    municipalityId: municipality.id,
    municipality: municipality.name,
  }).returning();

  const [daycare2] = await db.insert(daycares).values({
    name: 'Sateenkaari Päiväkoti',
    code: 'sateenkaari',
    municipalityId: municipality.id,
    municipality: municipality.name,
  }).returning();

  console.log(`✅ Created daycares: ${daycare1.name} (${daycare1.code}), ${daycare2.name} (${daycare2.code})`);

  // Create super admin (not tied to any daycare)
  const [superAdmin] = await db.insert(users).values({
    name: 'Super Admin',
    email: 'superadmin@roolit.fi',
    passwordHash: await bcrypt.hash('admin123', 10),
    role: 'super_admin',
    daycareId: null,
  }).returning();

  console.log(`✅ Created super admin: ${superAdmin.email}`);

  // Daycare 1: Aurinko - Users
  const [admin1] = await db.insert(users).values({
    name: 'Admin User',
    email: 'admin@aurinko.fi',
    passwordHash: hashedPassword,
    role: 'daycareleader',
    daycareId: daycare1.id,
  }).returning();

  const [staff1] = await db.insert(users).values({
    name: 'Maria Virtanen',
    email: 'maria@aurinko.fi',
    passwordHash: hashedPassword,
    role: 'staff',
    daycareId: daycare1.id,
  }).returning();

  const [guardian1] = await db.insert(users).values({
    name: 'Anna Korhonen',
    email: 'anna@example.fi',
    passwordHash: hashedPassword,
    role: 'guardian',
    daycareId: daycare1.id,
  }).returning();

  const [guardian2] = await db.insert(users).values({
    name: 'Mikko Nieminen',
    email: 'mikko@example.fi',
    passwordHash: hashedPassword,
    role: 'guardian',
    daycareId: daycare1.id,
  }).returning();

  // Daycare 1: Aurinko - Children
  const [child1] = await db.insert(children).values({
    name: 'Emilia Korhonen',
    birthdate: '2020-05-15',
    groupId: 1,
    daycareId: daycare1.id,
  }).returning();

  const [child2] = await db.insert(children).values({
    name: 'Aatos Nieminen',
    birthdate: '2019-08-22',
    groupId: 1,
    daycareId: daycare1.id,
  }).returning();

  const [child3] = await db.insert(children).values({
    name: 'Lilja Mäkinen',
    birthdate: '2021-02-10',
    groupId: 2,
    daycareId: daycare1.id,
  }).returning();

  // Daycare 1: Guardian-Child relationships
  await db.insert(guardians).values([
    { userId: guardian1.id, childId: child1.id },
    { userId: guardian2.id, childId: child2.id },
  ]);

  // Daycare 1: Entries
  const today = new Date();
  await db.insert(entries).values([
    {
      childId: child1.id,
      type: 'meal',
      value: 'Söi hyvin',
      note: 'Söi lautasen tyhjäksi',
      staffId: staff1.id,
      timestamp: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 30),
    },
    {
      childId: child1.id,
      type: 'sleep',
      value: 'Nukahti nopeasti',
      note: 'Päiväuni 2 tuntia',
      staffId: staff1.id,
      timestamp: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 13, 0),
    },
    {
      childId: child2.id,
      type: 'play',
      value: 'Leikkipuistossa',
      note: 'Leikki muiden lasten kanssa',
      staffId: staff1.id,
      timestamp: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0),
    },
  ]);

  // Daycare 1: Trips
  const [trip1] = await db.insert(trips).values({
    title: 'Luontoretki Nuuksioon',
    description: 'Retki Nuuksion kansallispuistoon. Mukaan eväät ja juomapullo. Lähtö klo 9:00, paluu noin klo 14:00.',
    date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).toISOString().split('T')[0],
    location: 'Nuuksio',
    cost: 0,
    createdBy: staff1.id,
    daycareId: daycare1.id,
    groupId: 1,
  }).returning();

  await db.insert(tripResponses).values([
    {
      tripId: trip1.id,
      guardianId: guardian1.id,
      childId: child1.id,
      response: 'approved',
    },
  ]);

  // Daycare 2: Sateenkaari - Users
  const [admin2] = await db.insert(users).values({
    name: 'Tiina Laine',
    email: 'admin@sateenkaari.fi',
    passwordHash: hashedPassword,
    role: 'daycareleader',
    daycareId: daycare2.id,
  }).returning();

  const [staff2] = await db.insert(users).values({
    name: 'Jukka Virtanen',
    email: 'jukka@sateenkaari.fi',
    passwordHash: hashedPassword,
    role: 'staff',
    daycareId: daycare2.id,
  }).returning();

  const [guardian3] = await db.insert(users).values({
    name: 'Laura Mäkelä',
    email: 'laura@test.fi',
    passwordHash: hashedPassword,
    role: 'guardian',
    daycareId: daycare2.id,
  }).returning();

  // Daycare 2: Sateenkaari - Children
  const [child4] = await db.insert(children).values({
    name: 'Ville Mäkelä',
    birthdate: '2020-11-03',
    groupId: 1,
    daycareId: daycare2.id,
  }).returning();

  const [child5] = await db.insert(children).values({
    name: 'Sofia Virtanen',
    birthdate: '2021-03-20',
    groupId: 1,
    daycareId: daycare2.id,
  }).returning();

  // Daycare 2: Guardian-Child relationships
  await db.insert(guardians).values([
    { userId: guardian3.id, childId: child4.id },
  ]);

  // Daycare 2: Entries
  await db.insert(entries).values([
    {
      childId: child4.id,
      type: 'meal',
      value: 'Söi melko hyvin',
      note: 'Jätti vihannekset',
      staffId: staff2.id,
      timestamp: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0),
    },
    {
      childId: child5.id,
      type: 'play',
      value: 'Piirteli',
      note: 'Piirsi kauniita kuvia',
      staffId: staff2.id,
      timestamp: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 30),
    },
  ]);

  // Daycare 2: Trips
  await db.insert(trips).values({
    title: 'Kirjasto käynti',
    description: 'Vierailu lähikirjastossa. Lapsille luetaan satuja.',
    date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5).toISOString().split('T')[0],
    location: 'Espoon kirjasto',
    cost: 0,
    createdBy: staff2.id,
    daycareId: daycare2.id,
    groupId: 1,
  }).returning();

  console.log('✅ Database seeded successfully with multi-tenant data!');
  console.log('\n📧 Login credentials:');
  console.log('\n👑 Super Admin:');
  console.log('   Email: superadmin@roolit.fi / admin123');
  console.log('\n🏫 Aurinko Päiväkoti (code: aurinko):');
  console.log('   Daycare leader: admin@aurinko.fi / password123  (role: daycareleader)');
  console.log('   Staff: maria@aurinko.fi / password123  (role: staff)');
  console.log('   Guardian: anna@example.fi / password123  (role: guardian)');
  console.log('\n🏫 Sateenkaari Päiväkoti (code: sateenkaari):');
  console.log('   Daycare leader: admin@sateenkaari.fi / password123  (role: daycareleader)');
  console.log('   Staff: jukka@sateenkaari.fi / password123  (role: staff)');
  console.log('   Guardian: laura@test.fi / password123  (role: guardian)');
}

seed()
  .catch((error) => {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
