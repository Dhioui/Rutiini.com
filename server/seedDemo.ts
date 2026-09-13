/**
 * Demo data for showing the product: one daycare, two groups, forty children.
 *
 * Separate from seed.ts on purpose. That one is the fixture CI signs in against
 * -- the workflow expects admin@aurinko.fi under the code "aurinko" -- so
 * rewriting it to produce a sales demo would break the build. This one is run by
 * hand, against whichever database is being shown.
 *
 * Every name, address and note below is invented. No real child, guardian or
 * daycare is represented here, and nothing in this file should ever be pointed at
 * a database holding real families.
 *
 * Re-running is refused rather than duplicated: it checks for the daycare code
 * first and stops if it is already there, because a second run would otherwise
 * produce eighty children and two of every account.
 */

import { db } from './db';
import {
  municipalities, daycares, daycareGroups, users, children, guardians,
  entries, mealMenus,
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const DAYCARE_CODE = 'demo';
const DAYCARE_NAME = 'Demopäiväkoti';
const MUNICIPALITY_NAME = 'Demolan kaupunki';
const MUNICIPALITY_CODE = 'DEMO';

/**
 * One password for every demo account, printed at the end.
 *
 * It satisfies the application's own strength rule, so these accounts behave
 * like real ones rather than being a special case. It is also written in this
 * file in plain sight, which is the point: it protects nothing and must never be
 * used for an account that matters.
 */
const DEMO_PASSWORD = 'Demo2026!';

const FIRST_NAMES = [
  'Aino', 'Eetu', 'Venla', 'Onni', 'Helmi', 'Väinö', 'Aada', 'Elias',
  'Emma', 'Leo', 'Sofia', 'Niilo', 'Iida', 'Oiva', 'Lilja', 'Toivo',
  'Ellen', 'Aarne', 'Sanni', 'Vilho', 'Milla', 'Eino', 'Nella', 'Otso',
  'Peppi', 'Arvo', 'Siiri', 'Urho', 'Kerttu', 'Into', 'Alma', 'Veeti',
  'Hilla', 'Samu', 'Tuuli', 'Joel', 'Maria', 'Lauri', 'Elsa', 'Kaarlo',
];

const FAMILY_NAMES = [
  'Aaltonen', 'Heikkilä', 'Järvinen', 'Kallio', 'Laaksonen', 'Manninen',
  'Nurmi', 'Ojala', 'Pulkkinen', 'Rantala', 'Salminen', 'Tuominen',
  'Uusitalo', 'Vanhanen', 'Ylinen', 'Ahonen', 'Eskola', 'Hakala',
  'Ikonen', 'Kinnunen', 'Lehtinen', 'Mustonen', 'Niemelä', 'Oksanen',
  'Paananen', 'Risatti', 'Sipilä', 'Tikkanen', 'Vainio', 'Wikström',
  'Yliaho', 'Aro', 'Halme', 'Koski',
];

const GUARDIAN_FIRST_NAMES = [
  'Katri', 'Mikael', 'Riikka', 'Tuomas', 'Hanna', 'Jussi', 'Petra', 'Antti',
  'Saara', 'Markus', 'Noora', 'Olli', 'Tiina', 'Henrik', 'Pauliina', 'Jere',
  'Laura', 'Kimmo', 'Jenni', 'Sami', 'Anniina', 'Roope', 'Heidi', 'Tapio',
  'Reetta', 'Ville', 'Suvi', 'Janne', 'Maija', 'Petri', 'Kaisa', 'Teemu',
  'Elina', 'Mika',
];

/** A few children carry care notes, so the allergy view has something in it. */
const CARE_NOTES: Record<number, { allergies?: string; diet?: string }> = {
  2: { allergies: 'Pähkinäallergia, vakava. EpiPen eteisen lääkekaapissa.' },
  5: { diet: 'Ei sianlihaa' },
  9: { allergies: 'Laktoosi-intoleranssi' },
  13: { diet: 'Kasvisruoka' },
  17: { allergies: 'Kananmuna-allergia', diet: 'Ei sianlihaa' },
  21: { allergies: 'Siitepölyallergia keväisin' },
  28: { diet: 'Ei sianlihaa' },
  33: { allergies: 'Vilja-allergia (gluteeniton)' },
};

/** The four types the entry form actually writes. */
const ENTRY_SAMPLES: Array<{ type: string; values: string[] }> = [
  { type: 'meal', values: ['Söi hyvin', 'Söi vähän', 'Maistoi kaikkea'] },
  { type: 'sleep', values: ['Nukkui 1 h 20 min', 'Nukkui 45 min', 'Ei nukkunut, lepäili'] },
  { type: 'play', values: ['Ulkoili pihalla', 'Rakenteli palikoilla', 'Maalasi sormiväreillä'] },
  { type: 'incident', values: ['Kaatui pihalla, pieni naarmu polvessa', 'Pieni kiista lelusta, selvitettiin'] },
];

const MENU_WEEK = [
  { lunch: 'Lohikeitto ja ruisleipä', veg: 'Juureskeitto ja ruisleipä', breakfast: 'Kaurapuuro ja marjat', snack: 'Omenaviipaleet ja jogurtti', diet: 'L,G' },
  { lunch: 'Jauhelihakastike ja perunat', veg: 'Soijarouhekastike ja perunat', breakfast: 'Mannapuuro', snack: 'Näkkileipä ja kurkku', diet: 'L' },
  { lunch: 'Broilerpasta ja salaatti', veg: 'Kasvispasta ja salaatti', breakfast: 'Riisipuuro ja kaneli', snack: 'Banaani ja maito', diet: 'M' },
  { lunch: 'Kalapuikot, muusi ja herneet', veg: 'Kasvispihvit, muusi ja herneet', breakfast: 'Ohrapuuro', snack: 'Mustikkakiisseli', diet: 'L,G' },
  { lunch: 'Hernekeitto ja pannukakku', veg: 'Kasvishernekeitto ja pannukakku', breakfast: 'Neljän viljan puuro', snack: 'Porkkanaraaste ja leipä', diet: 'M' },
];

/** The five most recent weekdays, oldest first, as YYYY-MM-DD. */
function lastFiveWeekdays(from = new Date()): string[] {
  const days: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while (days.length < 5) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return days.reverse();
}

/** Birthdate for a child of roughly the given age, spread across the year. */
function birthdate(ageYears: number, index: number): string {
  const year = new Date().getUTCFullYear() - ageYears;
  const month = (index % 12) + 1;
  const day = ((index * 7) % 27) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function seedDemo() {
  const existing = await db.select().from(daycares).where(eq(daycares.code, DAYCARE_CODE)).limit(1);
  if (existing.length > 0) {
    console.error(
      `Daycare code "${DAYCARE_CODE}" already exists (id ${existing[0].id}).\n` +
      'Refusing to run: a second pass would add another forty children and a ' +
      'duplicate of every account. Remove the existing demo daycare first, or ' +
      'change DAYCARE_CODE in this file.'
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const weekdays = lastFiveWeekdays();

  // One transaction: an interrupted run leaves nothing behind rather than a
  // half-built daycare that the guard above would then refuse to complete.
  await db.transaction(async (tx) => {
    const [municipality] = await tx.insert(municipalities).values({
      name: MUNICIPALITY_NAME,
      code: MUNICIPALITY_CODE,
    }).returning();

    const [daycare] = await tx.insert(daycares).values({
      name: DAYCARE_NAME,
      code: DAYCARE_CODE,
      municipalityId: municipality.id,
      municipality: municipality.name,
      // The menu below is inserted directly, so no scraper is configured.
      menuSourceType: 'manual',
    }).returning();

    const groupRows = await tx.insert(daycareGroups).values([
      { daycareId: daycare.id, name: 'Oravat (1-3 v)' },
      { daycareId: daycare.id, name: 'Siilit (4-5 v)' },
    ]).returning();
    const [younger, older] = groupRows;

    // passwordNeedsReset is false for every demo account. Left at its default the
    // first sign-in is a forced password change, which is correct for a real
    // deployment and wrong for a demo -- whoever is being shown the product would
    // hit a change-password form before seeing anything.
    const [leader] = await tx.insert(users).values({
      name: 'Marjut Salo',
      email: 'johtaja@demopaivakoti.fi',
      passwordHash,
      role: 'daycareleader',
      daycareId: daycare.id,
      passwordNeedsReset: false,
    }).returning();

    const staffRows = await tx.insert(users).values([
      {
        name: 'Tuomas Lehto', email: 'kasvattaja@demopaivakoti.fi', passwordHash,
        role: 'staff', daycareId: daycare.id, passwordNeedsReset: false,
      },
      {
        name: 'Sanna Koskinen', email: 'sanna.koskinen@demopaivakoti.fi', passwordHash,
        role: 'staff', daycareId: daycare.id, passwordNeedsReset: false,
      },
    ]).returning();

    // Forty children across the two groups, twenty each.
    const childRows = await tx.insert(children).values(
      FIRST_NAMES.map((first, i) => {
        const family = FAMILY_NAMES[i % FAMILY_NAMES.length];
        const inYounger = i < 20;
        return {
          name: `${first} ${family}`,
          birthdate: birthdate(inYounger ? 2 : 5, i),
          groupId: inYounger ? younger.id : older.id,
          daycareId: daycare.id,
          allergies: CARE_NOTES[i]?.allergies ?? null,
          diet: CARE_NOTES[i]?.diet ?? null,
        };
      })
    ).returning();

    // One guardian account per family name. Six of the families have two children
    // in the daycare, which is what makes the guardian view worth looking at: the
    // child picker has something to pick between.
    const guardianRows = await tx.insert(users).values(
      FAMILY_NAMES.map((family, i) => ({
        name: `${GUARDIAN_FIRST_NAMES[i % GUARDIAN_FIRST_NAMES.length]} ${family}`,
        email: `huoltaja${i + 1}@esimerkki.invalid`,
        passwordHash,
        role: 'guardian',
        daycareId: daycare.id,
        passwordNeedsReset: false,
      }))
    ).returning();

    // The named demo guardian is the one with two children, so a demo can show
    // switching between them.
    const demoGuardianIndex = 0;
    await tx.update(users)
      .set({ email: 'huoltaja@esimerkki.invalid' })
      .where(eq(users.id, guardianRows[demoGuardianIndex].id));

    await tx.insert(guardians).values(
      childRows.map((child, i) => ({
        userId: guardianRows[i % FAMILY_NAMES.length].id,
        childId: child.id,
      }))
    );

    // A week of entries: every child gets one meal, one sleep and one play note
    // per weekday, and a few get an incident. Timestamps land during the day so
    // the dashboard's "recent entries" panel reads sensibly.
    const entryValues: Array<typeof entries.$inferInsert> = [];
    for (let dayIndex = 0; dayIndex < weekdays.length; dayIndex++) {
      const day = weekdays[dayIndex];
      for (let childIndex = 0; childIndex < childRows.length; childIndex++) {
        const child = childRows[childIndex];
        const staff = staffRows[childIndex < 20 ? 0 : 1];
        for (let sampleIndex = 0; sampleIndex < ENTRY_SAMPLES.length; sampleIndex++) {
          const sample = ENTRY_SAMPLES[sampleIndex];
          // Incidents are occasional, not daily.
          if (sample.type === 'incident' && (childIndex + dayIndex) % 17 !== 0) continue;
          const hour = 8 + sampleIndex * 3;
          entryValues.push({
            childId: child.id,
            type: sample.type,
            value: sample.values[(childIndex + dayIndex) % sample.values.length],
            note: '',
            staffId: staff.id,
            timestamp: new Date(`${day}T${String(hour).padStart(2, '0')}:30:00Z`),
          });
        }
      }
    }
    await tx.insert(entries).values(entryValues);

    // The same five weekdays, four meals each.
    await tx.insert(mealMenus).values(
      weekdays.flatMap((day, i) => {
        const menu = MENU_WEEK[i % MENU_WEEK.length];
        return [
          { daycareId: daycare.id, date: day, mealType: 'breakfast', foodName: menu.breakfast, dietInfo: menu.diet },
          { daycareId: daycare.id, date: day, mealType: 'lunch', foodName: menu.lunch, dietInfo: menu.diet },
          { daycareId: daycare.id, date: day, mealType: 'vegetarian_lunch', foodName: menu.veg, dietInfo: `${menu.diet},Veg` },
          { daycareId: daycare.id, date: day, mealType: 'snack', foodName: menu.snack, dietInfo: menu.diet },
        ];
      })
    );

    console.log(`Kunta:        ${municipality.name} (${municipality.code})`);
    console.log(`Päiväkoti:    ${daycare.name} (koodi: ${daycare.code})`);
    console.log(`Ryhmät:       ${younger.name}, ${older.name}`);
    console.log(`Lapsia:       ${childRows.length}`);
    console.log(`Huoltajia:    ${guardianRows.length}`);
    console.log(`Merkintöjä:   ${entryValues.length} (${weekdays[0]} - ${weekdays[weekdays.length - 1]})`);
    console.log(`Ruokalista:   ${weekdays.length} päivää x 4 ateriaa`);
    console.log(`Johtaja:      ${leader.name}`);
  });

  console.log('');
  console.log('Demotunnukset -- päiväkotikoodi: ' + DAYCARE_CODE);
  console.log(`  Johtaja:    johtaja@demopaivakoti.fi     / ${DEMO_PASSWORD}`);
  console.log(`  Kasvattaja: kasvattaja@demopaivakoti.fi  / ${DEMO_PASSWORD}`);
  console.log(`  Huoltaja:   huoltaja@esimerkki.invalid   / ${DEMO_PASSWORD}`);
  console.log('');
  console.log('Kaikki tiedot ovat keksittyjä.');
}

seedDemo()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Demodatan luonti epäonnistui:', error);
    process.exit(1);
  });
