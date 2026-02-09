// Seed script: Generate realistic church data
// Run with: node seed.mjs

const SUPABASE_URL = 'https://szligatlxwpcknwkhdyp.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6bGlnYXRseHdwY2tud2toZHlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTUyNTk4MywiZXhwIjoyMDc3MTAxOTgzfQ.SVrt-g42HzB_-SpbI2fYJwOrsYseohDuE2gFixjLKM0';

const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

async function rpc(table, method, body, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${table}: ${res.status} ${text}`);
  }
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('json')) return res.json();
  return null;
}

// ── Helpers ──
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return Math.round((Math.random() * (max - min) + min) * 100) / 100; }
function dateStr(d) { return d.toISOString().split('T')[0]; }
function uuid() { return crypto.randomUUID(); }

// ── Ghanaian Names ──
const maleFirst = ['Kwame','Kofi','Kwesi','Yaw','Kwaku','Kwabena','Kojo','Nana','Ebo','Fiifi','Ekow','Papa','Kobby','Nii','Mensah','Emmanuel','Daniel','Samuel','Joseph','David','Isaac','Benjamin','Michael','Stephen','Peter','John','James','Philip','Andrew','Thomas','Caleb','Joshua','Elijah','Solomon','Gideon','Abel','Seth','Aaron','Moses','Nathaniel'];
const femaleFirst = ['Ama','Akua','Abena','Yaa','Afia','Efua','Adwoa','Nana','Esi','Araba','Akosua','Adjoa','Afua','Ekua','Maame','Grace','Mercy','Ruth','Esther','Naomi','Priscilla','Lydia','Hannah','Sarah','Rebecca','Deborah','Miriam','Martha','Eunice','Joyce','Gloria','Comfort','Patience','Beatrice','Theresa','Victoria','Cecilia','Juliana','Millicent','Gladys'];
const lastNames = ['Mensah','Asante','Boateng','Ofori','Owusu','Amoah','Agyei','Danquah','Appiah','Kumi','Adjei','Osei','Yeboah','Twum','Ansah','Quaye','Tetteh','Laryea','Nkrumah','Aidoo','Bonsu','Afriyie','Darko','Frimpong','Sarpong','Badu','Gyasi','Ampofo','Ankrah','Adu','Boakye','Asamoah','Kyei','Asare','Nuamah','Opoku','Addo','Mensah-Bonsu','Baah','Antwi'];
const otherNames = ['Nii','Naa','Nene','Togbe','Mama','Ohene','Barima','Obaa','Maame','Awura','Opanyin','','','','','','','',''];

const zones = ['A','B','F','K','M','R'];
const locations = ['Accra','Tema','Kumasi','Kasoa','Madina','Spintex','Teshie','Labadi','Osu','Cantonments','Airport Residential','East Legon','Dansoman','Darkuman','Mamprobi','Chorkor','Achimota','Legon','Tesano','Abeka','Lapaz','Dome','Ashongman','Haatso','Taifa','Ofankor','Pokuase','Ablekuma','Kokomlemle','Asylum Down'];
const digitalAddresses = () => `G${pick(['A','L','R','T','M','K'])}-${randInt(100,999)}-${randInt(1000,9999)}`;
const phones = () => `0${pick(['24','20','26','27','54','55','50'])}${randInt(1000000,9999999)}`;
const ministries = ['Choir','Ushering','Youth Ministry','Children Ministry','Prayer Warriors','Media Team','Welfare','Evangelism','Men Fellowship','Women Fellowship','Hospitality','Technical Team','Dance Ministry','Drama Team','Sunday School','Bible Study','Counselling'];
const serviceTypes = ['Sunday Morning Service','Sunday School','Bible Study','Prayer Meeting','Youth Service','Midweek Service','Special Service'];

// ── Generate Sundays from Nov 2024 to Jan 26 2026 ──
function getSundays(startDate, endDate) {
  const sundays = [];
  const d = new Date(startDate);
  // Move to first Sunday
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  while (d <= endDate) {
    sundays.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return sundays;
}

const sundays = getSundays(new Date('2024-11-01'), new Date('2026-01-25'));
console.log(`Generated ${sundays.length} Sundays from ${dateStr(sundays[0])} to ${dateStr(sundays[sundays.length-1])}`);

// ── Step 1: Clear existing data ──
async function clearData() {
  console.log('Clearing existing data...');
  // Order matters due to FK constraints
  await rpc('absentee_records', 'DELETE', null, '?id=not.is.null');
  await rpc('attendance_entries', 'DELETE', null, '?id=not.is.null');
  await rpc('attendance_records', 'DELETE', null, '?id=not.is.null');
  await rpc('giving_records', 'DELETE', null, '?id=not.is.null');
  await rpc('family_members', 'DELETE', null, '?id=not.is.null');
  await rpc('member_status_log', 'DELETE', null, '?id=not.is.null');
  await rpc('visitors', 'DELETE', null, '?id=not.is.null');
  await rpc('members', 'DELETE', null, '?id=not.is.null');
  await rpc('custom_giving_types', 'DELETE', null, '?id=not.is.null');
  console.log('All data cleared (users untouched).');
}

// ── Step 2: Generate Members ──
function generateMembers() {
  const members = [];
  const usedZoneNumbers = new Set();

  for (let i = 0; i < 100; i++) {
    const gender = Math.random() < 0.48 ? 'male' : 'female';
    const firstName = pick(gender === 'male' ? maleFirst : femaleFirst);
    const lastName = pick(lastNames);
    const otherName = pick(otherNames);
    const zone = zones[i % 6]; // Distribute evenly-ish across zones

    let zoneNum;
    do { zoneNum = `${zone}${String(randInt(1, 999)).padStart(3, '0')}`; } while (usedZoneNumbers.has(zoneNum));
    usedZoneNumbers.add(zoneNum);

    // Join dates: spread from Nov 2024 backward to simulate existing congregation
    // ~60 members joined before Nov 2024, ~40 joined between Nov 2024 and Jan 2026
    let joinDate;
    if (i < 60) {
      // Existing members, joined 1-5 years ago
      const yearsAgo = randFloat(0.5, 5);
      const d = new Date('2024-11-01');
      d.setDate(d.getDate() - Math.floor(yearsAgo * 365));
      joinDate = dateStr(d);
    } else {
      // New members who joined during our data period
      const sundayIndex = randInt(0, sundays.length - 1);
      joinDate = dateStr(sundays[sundayIndex]);
    }

    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - randInt(18, 72));
    dob.setMonth(randInt(0, 11));
    dob.setDate(randInt(1, 28));

    const maritalOptions = ['single', 'married', 'divorced', 'widowed'];
    const age = new Date().getFullYear() - dob.getFullYear();
    const maritalStatus = age < 25 ? (Math.random() < 0.85 ? 'single' : 'married') :
                          age < 40 ? pick(['single', 'married', 'married', 'married', 'divorced']) :
                          pick(['married', 'married', 'married', 'divorced', 'widowed']);

    // Status distribution: mostly active
    let status;
    if (i < 55) status = 'active';
    else if (i < 70) status = 'semi-active';
    else if (i < 80) status = 'inactive';
    else if (i < 90) status = 'new';
    else if (i < 95) status = 'sabbatical';
    else status = 'blacklisted';

    const memberMinistries = [];
    const numMinistries = randInt(0, 3);
    const availableMinistries = [...ministries];
    for (let m = 0; m < numMinistries; m++) {
      const idx = randInt(0, availableMinistries.length - 1);
      memberMinistries.push(availableMinistries.splice(idx, 1)[0]);
    }

    const baptismInfo = Math.random() < 0.7 ? {
      baptized: true,
      baptism_date: dateStr(new Date(dob.getTime() + randInt(5, 30) * 365 * 86400000)),
      baptism_church: pick(['CoC Main', 'CoC Tema Branch', 'CoC Kumasi', 'Previous Church', 'Catholic Church', 'Methodist Church']),
    } : Math.random() < 0.5 ? { baptized: false } : null;

    const sabbaticalStart = status === 'sabbatical' ? dateStr(new Date(Date.now() - randInt(7, 90) * 86400000)) : null;
    const sabbaticalEnd = status === 'sabbatical' && Math.random() < 0.5 ? dateStr(new Date(Date.now() + randInt(30, 180) * 86400000)) : null;
    const sabbaticalReason = status === 'sabbatical' ? pick(['Medical leave', 'Relocation', 'Personal reasons', 'Family matters', 'Further studies abroad']) : null;

    members.push({
      id: uuid(),
      first_name: firstName,
      last_name: lastName,
      other_names: otherName || null,
      email: Math.random() < 0.7 ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randInt(1,99)}@${pick(['gmail.com','yahoo.com','outlook.com','hotmail.com'])}` : null,
      phone: phones(),
      second_phone: Math.random() < 0.3 ? phones() : null,
      gender,
      date_of_birth: dateStr(dob),
      residence_location: pick(locations),
      digital_address: Math.random() < 0.6 ? digitalAddresses() : null,
      zone,
      zone_number: zoneNum,
      notes: Math.random() < 0.2 ? pick(['Very committed member', 'Recently relocated', 'Needs pastoral visit', 'Active in community outreach', 'Transferred from another branch', '']) : null,
      status,
      marital_status: maritalStatus,
      join_date: joinDate,
      ministries: memberMinistries,
      baptism_info: baptismInfo,
      sabbatical_start_date: sabbaticalStart,
      sabbatical_end_date: sabbaticalEnd,
      sabbatical_reason: sabbaticalReason,
      created_at: new Date(joinDate + 'T10:00:00Z').toISOString(),
    });
  }

  return members;
}

// ── Step 3: Generate Visitors ──
function generateVisitors() {
  const visitors = [];
  for (let i = 0; i < 20; i++) {
    const gender = Math.random() < 0.5 ? 'male' : 'female';
    const firstName = pick(gender === 'male' ? maleFirst : femaleFirst);
    const lastName = pick(lastNames);

    // Visit dates spread across our period
    const visitSunday = pick(sundays.slice(Math.floor(sundays.length * 0.3)));

    const followUpStatuses = ['pending', 'contacted', 'scheduled', 'completed'];
    const followUp = pick(followUpStatuses);

    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - randInt(18, 55));
    dob.setMonth(randInt(0, 11));
    dob.setDate(randInt(1, 28));

    visitors.push({
      id: uuid(),
      first_name: firstName,
      last_name: lastName,
      other_names: Math.random() < 0.3 ? pick(otherNames.filter(n => n)) : null,
      email: Math.random() < 0.5 ? `${firstName.toLowerCase()}${randInt(1,99)}@${pick(['gmail.com','yahoo.com'])}` : null,
      phone: phones(),
      second_phone: Math.random() < 0.15 ? phones() : null,
      gender,
      date_of_birth: Math.random() < 0.6 ? dateStr(dob) : null,
      residence_location: pick(locations),
      visit_date: dateStr(visitSunday),
      service_type: pick(['Sunday Morning Service', 'Sunday Evening Service', 'Special Service', 'Youth Service']),
      referred_by: Math.random() < 0.6 ? `${pick(maleFirst.concat(femaleFirst))} ${pick(lastNames)}` : null,
      interested_in_membership: Math.random() < 0.65,
      notes: Math.random() < 0.3 ? pick(['Very enthusiastic', 'Came with a friend', 'Lives nearby', 'Looking for a church home', 'First time in the area']) : null,
      follow_up_status: followUp,
      potential_zone: Math.random() < 0.5 ? pick(zones) : null,
      converted_to_member: i < 3, // First 3 converted
      created_at: new Date(dateStr(visitSunday) + 'T12:00:00Z').toISOString(),
    });
  }
  return visitors;
}

// ── Step 4: Generate Attendance Records + Entries + Absentee ──
function generateAttendance(members, sundays) {
  const records = [];
  const entries = [];
  const absentees = [];

  // Filter members who were already joined before each Sunday
  const activeMemberStatuses = new Set(['active', 'semi-active', 'new']);
  const attendableStatuses = new Set(['active', 'semi-active', 'new', 'inactive']);

  for (const sunday of sundays) {
    const sundayStr = dateStr(sunday);

    // Eligible members (joined before or on this date and not blacklisted/sabbatical at the time)
    const eligible = members.filter(m => m.join_date <= sundayStr && attendableStatuses.has(m.status));

    // ── Sunday Morning Service (Individual Attendance) ──
    const morningId = uuid();
    const morningAttendees = [];
    const morningAbsentees = [];

    for (const member of eligible) {
      // Attendance probability based on status
      let prob;
      if (member.status === 'active') prob = 0.82;
      else if (member.status === 'semi-active') prob = 0.45;
      else if (member.status === 'new') prob = 0.70;
      else prob = 0.15; // inactive

      // Seasonal variation: lower in Dec (holidays), higher in Jan (new year)
      const month = sunday.getMonth();
      if (month === 11) prob *= 0.85;
      if (month === 0) prob *= 1.05;

      if (Math.random() < prob) {
        morningAttendees.push(member);
        entries.push({
          id: uuid(),
          attendance_record_id: morningId,
          member_id: member.id,
          created_at: new Date(sundayStr + 'T09:30:00Z').toISOString(),
        });
      } else {
        // Some absentees have reasons recorded
        if (Math.random() < 0.25) {
          const requestedPermission = Math.random() < 0.4;
          const reason = pick(['Sick', 'Travel', 'Work', 'Family Emergency', 'Other']);
          const absStartDate = new Date(sunday);
          absStartDate.setDate(absStartDate.getDate() - randInt(0, 3));
          const untilFurther = Math.random() < 0.1;
          const absEndDate = untilFurther ? null : new Date(sunday);
          if (absEndDate) absEndDate.setDate(absEndDate.getDate() + randInt(0, 14));

          morningAbsentees.push({
            id: uuid(),
            attendance_record_id: morningId,
            member_id: member.id,
            requested_permission: requestedPermission,
            reason: reason,
            reason_notes: Math.random() < 0.3 ? pick([
              'Will be back next week', 'Out of town for work', 'Hospital admission',
              'Family event', 'Travelling to hometown', 'Night shift at work',
              'Caring for sick relative', 'Exam preparation'
            ]) : null,
            absence_start_date: dateStr(absStartDate),
            absence_end_date: absEndDate ? dateStr(absEndDate) : null,
            until_further_notice: untilFurther,
            created_at: new Date(sundayStr + 'T10:00:00Z').toISOString(),
          });
        }
      }
    }

    records.push({
      id: morningId,
      date: sundayStr,
      service_type: 'Sunday Morning Service',
      attendance_type: 'individual',
      start_time: '09:00',
      end_time: '12:00',
      total_count: morningAttendees.length,
      is_custom_service: false,
      created_at: new Date(sundayStr + 'T09:00:00Z').toISOString(),
    });

    absentees.push(...morningAbsentees);

    // ── Sunday Evening Service (General/Head Count ~60% of the time) ──
    if (Math.random() < 0.6) {
      const eveningId = uuid();
      const eveningCount = Math.round(morningAttendees.length * randFloat(0.35, 0.55));
      records.push({
        id: eveningId,
        date: sundayStr,
        service_type: 'Sunday Evening Service',
        attendance_type: 'general',
        start_time: '17:00',
        end_time: '19:00',
        total_count: eveningCount,
        is_custom_service: false,
        created_at: new Date(sundayStr + 'T17:00:00Z').toISOString(),
      });
    }
  }

  return { records, entries, absentees };
}

// ── Step 5: Generate Giving Records ──
function generateGiving(sundays) {
  const givingRecords = [];

  for (const sunday of sundays) {
    const sundayStr = dateStr(sunday);
    const month = sunday.getMonth();

    // Base amounts with seasonal variation
    let offeringBase = randFloat(800, 2500);
    let donationBase = randFloat(200, 1200);
    let thanksgivingBase = randFloat(100, 800);

    // December: higher giving (Christmas)
    if (month === 11) { offeringBase *= 1.6; donationBase *= 1.4; thanksgivingBase *= 2.0; }
    // January: slightly higher (new year)
    if (month === 0) { offeringBase *= 1.2; thanksgivingBase *= 1.3; }
    // Easter period (March/April)
    if (month === 2 || month === 3) { offeringBase *= 1.15; }

    const offering = Math.round(offeringBase * 100) / 100;
    const donation = Math.round(donationBase * 100) / 100;
    const thanksgiving = Math.round(thanksgivingBase * 100) / 100;

    // Custom types occasionally
    const customTypes = {};
    if (Math.random() < 0.25) {
      customTypes['Building Fund'] = Math.round(randFloat(100, 600) * 100) / 100;
    }
    if (Math.random() < 0.15) {
      customTypes['Missions'] = Math.round(randFloat(50, 300) * 100) / 100;
    }
    const customTotal = Object.values(customTypes).reduce((s, v) => s + v, 0);

    const total = Math.round((offering + donation + thanksgiving + customTotal) * 100) / 100;

    // Payment method distribution
    const cashPct = randFloat(0.4, 0.65);
    const mmPct = randFloat(0.2, 0.35);
    const cardPct = randFloat(0.02, 0.1);
    const btPct = 1 - cashPct - mmPct - cardPct;

    const cashAmount = Math.round(total * cashPct * 100) / 100;
    const mmAmount = Math.round(total * mmPct * 100) / 100;
    const cardAmount = Math.round(total * cardPct * 100) / 100;
    const btAmount = Math.round((total - cashAmount - mmAmount - cardAmount) * 100) / 100;

    givingRecords.push({
      id: uuid(),
      service_name: 'Sunday Morning Service',
      service_date: sundayStr,
      service_type: 'sunday_morning',
      offering_amount: offering,
      donation_amount: donation,
      thanksgiving_amount: thanksgiving,
      custom_types: Object.keys(customTypes).length > 0 ? customTypes : {},
      total_amount: total,
      cash_amount: cashAmount,
      mobile_money_amount: mmAmount,
      card_amount: cardAmount,
      bank_transfer_amount: btAmount,
      notes: Math.random() < 0.1 ? pick(['Special thanksgiving service', 'Harvest sunday', 'Communion service giving', 'Anniversary thanksgiving']) : null,
      created_at: new Date(sundayStr + 'T12:30:00Z').toISOString(),
    });
  }

  return givingRecords;
}

// ── Step 6: Generate Family Relationships ──
function generateFamilies(members) {
  const families = [];
  const married = members.filter(m => m.marital_status === 'married');

  // Pair up some married members as spouses
  const maleMarried = married.filter(m => m.gender === 'male');
  const femaleMarried = married.filter(m => m.gender === 'female');
  const pairCount = Math.min(maleMarried.length, femaleMarried.length, 8);

  for (let i = 0; i < pairCount; i++) {
    // Husband → Wife (linked)
    families.push({
      id: uuid(),
      member_id: maleMarried[i].id,
      relationship: 'spouse',
      first_name: femaleMarried[i].first_name,
      last_name: femaleMarried[i].last_name,
      phone: femaleMarried[i].phone,
      is_linked: true,
      linked_member_id: femaleMarried[i].id,
    });
    // Wife → Husband (linked)
    families.push({
      id: uuid(),
      member_id: femaleMarried[i].id,
      relationship: 'spouse',
      first_name: maleMarried[i].first_name,
      last_name: maleMarried[i].last_name,
      phone: maleMarried[i].phone,
      is_linked: true,
      linked_member_id: maleMarried[i].id,
    });

    // Add children (not members, unlinked)
    const numChildren = randInt(0, 3);
    for (let c = 0; c < numChildren; c++) {
      const childGender = Math.random() < 0.5 ? 'male' : 'female';
      families.push({
        id: uuid(),
        member_id: maleMarried[i].id,
        relationship: 'child',
        first_name: pick(childGender === 'male' ? maleFirst : femaleFirst),
        last_name: maleMarried[i].last_name,
        phone: null,
        is_linked: false,
        linked_member_id: null,
      });
    }
  }

  // Add some parent relationships (unlinked)
  for (let i = 0; i < 15; i++) {
    const member = members[i];
    families.push({
      id: uuid(),
      member_id: member.id,
      relationship: 'mother',
      first_name: pick(femaleFirst),
      last_name: member.last_name,
      phone: Math.random() < 0.4 ? phones() : null,
      is_linked: false,
      linked_member_id: null,
    });
    if (Math.random() < 0.7) {
      families.push({
        id: uuid(),
        member_id: member.id,
        relationship: 'father',
        first_name: pick(maleFirst),
        last_name: member.last_name,
        phone: Math.random() < 0.3 ? phones() : null,
        is_linked: false,
        linked_member_id: null,
      });
    }
  }

  // Some sibling relationships (linked between members)
  for (let i = 0; i < 5; i++) {
    const a = members[randInt(0, 30)];
    const b = members[randInt(31, 60)];
    families.push({
      id: uuid(),
      member_id: a.id,
      relationship: 'sibling',
      first_name: b.first_name,
      last_name: b.last_name,
      phone: b.phone,
      is_linked: true,
      linked_member_id: b.id,
    });
  }

  return families;
}

// ── Step 7: Generate Custom Giving Types ──
function generateCustomGivingTypes() {
  return [
    { id: uuid(), name: 'Building Fund', description: 'Contributions towards the church building project', is_active: true },
    { id: uuid(), name: 'Missions', description: 'Support for missionary activities', is_active: true },
    { id: uuid(), name: 'Youth Fund', description: 'Youth ministry activities fund', is_active: true },
    { id: uuid(), name: 'Welfare', description: 'Welfare and benevolence fund', is_active: false },
  ];
}

// ── Insert in batches ──
async function insertBatch(table, rows, batchSize = 50) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await rpc(table, 'POST', batch);
    process.stdout.write(`  ${table}: ${Math.min(i + batchSize, rows.length)}/${rows.length}\r`);
  }
  console.log(`  ${table}: ${rows.length} rows inserted.`);
}

// ── Main ──
async function main() {
  console.log('=== Church Data Seed Script ===\n');

  // 1. Clear
  await clearData();

  // 2. Generate data
  console.log('\nGenerating data...');
  const members = generateMembers();
  console.log(`  ${members.length} members generated`);

  const visitors = generateVisitors();
  console.log(`  ${visitors.length} visitors generated`);

  const { records, entries, absentees } = generateAttendance(members, sundays);
  console.log(`  ${records.length} attendance records, ${entries.length} entries, ${absentees.length} absentee records`);

  const giving = generateGiving(sundays);
  console.log(`  ${giving.length} giving records`);

  const families = generateFamilies(members);
  console.log(`  ${families.length} family relationships`);

  const customTypes = generateCustomGivingTypes();
  console.log(`  ${customTypes.length} custom giving types`);

  // 3. Insert
  console.log('\nInserting data...');
  await insertBatch('custom_giving_types', customTypes);
  await insertBatch('members', members);
  await insertBatch('visitors', visitors);
  await insertBatch('attendance_records', records);
  await insertBatch('attendance_entries', entries, 100);
  await insertBatch('absentee_records', absentees, 100);
  await insertBatch('giving_records', giving);
  await insertBatch('family_members', families);

  console.log('\n=== Seed complete! ===');
  console.log(`Summary:`);
  console.log(`  Members: ${members.length}`);
  console.log(`  Visitors: ${visitors.length}`);
  console.log(`  Attendance Records: ${records.length}`);
  console.log(`  Attendance Entries: ${entries.length}`);
  console.log(`  Absentee Records: ${absentees.length}`);
  console.log(`  Giving Records: ${giving.length}`);
  console.log(`  Family Relationships: ${families.length}`);
  console.log(`  Custom Giving Types: ${customTypes.length}`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
