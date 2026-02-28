import fs from 'fs';
import path from 'path';

// Ghanaian Names Seed Data
const firstNamesMale = ['Kwame', 'Kofi', 'Kwasi', 'Kojo', 'Yaw', 'Kwabena', 'Kwaku', 'Emmanuel', 'Samuel', 'Daniel', 'Michael', 'Joseph', 'Bright', 'Prince', 'Ebenezer', 'Isaac', 'David'];
const firstNamesFemale = ['Ama', 'Efua', 'Akosua', 'Adwoa', 'Abena', 'Akua', 'Yaa', 'Grace', 'Mary', 'Esther', 'Martha', 'Ruth', 'Sarah', 'Joy', 'Peace', 'Patience', 'Mercy', 'Gloria', 'Eunice'];
const lastNames = ['Mensah', 'Osei', 'Owusu', 'Boateng', 'Asante', 'Appiah', 'Agyemang', 'Boakye', 'Amoah', 'Agyapong', 'Frimpong', 'Opoku', 'Acheampong', 'Yeboah', 'Addae', 'Danso', 'Ofori', 'Annan', 'Tetteh', 'Quaye', 'Sowah', 'Laryea', 'Quartey'];
const locations = ['Madina', 'Adenta', 'Legon', 'Osu', 'Cantonments', 'East Legon', 'Dansoman', 'Kasoa', 'Achimota', 'Spintex', 'Tema', 'Nungua', 'Teshie', 'Labadi', 'Dzorwulu', 'Airport Residential', 'Tesano', 'Lapaz', 'Kaneshie', 'Awoshie'];
const professions = ['Teacher', 'Nurse', 'Engineer', 'Trader', 'Banker', 'Civil Servant', 'IT Consultant', 'Mechanic', 'Doctor', 'Businessman', 'Student', 'Plumber', 'Electrician', 'Carpenter', 'Pastor'];

const zones = ['A', 'B', 'F', 'K', 'M', 'R'];

function randomChoice<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function generatePhone() { return `+233${randomChoice(['24', '54', '55', '20', '50', '26', '56', '27', '57'])}${randomInt(1000000, 9999999)}`; }
function generateDate(startYear: number, endYear: number) {
  const d = new Date();
  d.setFullYear(randomInt(startYear, endYear));
  d.setMonth(randomInt(0, 11));
  d.setDate(randomInt(1, 28));
  return d.toISOString().split('T')[0];
}
function sqlEscape(str: string | null) {
  if (str === null || str === undefined) return 'NULL';
  if (typeof str === 'boolean') return str ? 'true' : 'false';
  return `'${String(str).replace(/'/g, "''")}'`;
}
function uuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }); }

async function runSeed() {
  console.log('Generating seed.sql for ~500 members...');
  let sql = `-- Seed Data Generated for Accra, Ghana\n-- ${new Date().toISOString()}\n\n`;
  
  // Note: Using a fixed UUID context or random for seed. We will map them out to keep rels correct.
  
  const insertedMembers = [];
  const memberInserts = [];

  // Generate 350 Main Members
  for (let i = 0; i < 350; i++) {
    const isMale = Math.random() > 0.5;
    const isBaptised = Math.random() > 0.2; 
    const status = Math.random() > 0.8 ? randomChoice(['semi-active', 'inactive', 'sick']) : 'active';
    const zone = randomChoice(zones);

    const baptismInfo = isBaptised ? {
      dateType: 'full',
      fullDate: generateDate(1990, 2023),
      previousCongregation: Math.random() > 0.7 ? 'Another Assembly' : ''
    } : { dateType: 'not_baptised' };
    
    const memId = uuid();
    insertedMembers.push({ id: memId, gender: isMale ? 'male' : 'female' });

    memberInserts.push(`(
      '${memId}', ${sqlEscape(randomChoice(isMale ? firstNamesMale : firstNamesFemale))}, ${sqlEscape(randomChoice(lastNames))}, 
      ${sqlEscape(Math.random() > 0.5 ? randomChoice(isMale ? firstNamesMale : firstNamesFemale) : '')}, 
      ${sqlEscape(generatePhone())}, ${sqlEscape(isMale ? 'male' : 'female')}, ${sqlEscape(generateDate(1950, 2005))}, 
      ${sqlEscape(randomChoice(locations))}, ${sqlEscape(zone)}, ${sqlEscape(`${zone}${String(i + 1).padStart(3, '0')}-${randomInt(10, 99)}`)}, 
      ${sqlEscape(status)}, ${sqlEscape(generateDate(2010, 2024))}, 
      ${sqlEscape(JSON.stringify(baptismInfo))}, ${sqlEscape(JSON.stringify(Math.random() > 0.6 ? ['Ushering'] : []))}
    )`);
  }

  sql += `-- Insert Main Members\n`;
  sql += `INSERT INTO members (id, first_name, last_name, other_names, phone, gender, date_of_birth, residence_location, zone, zone_number, status, join_date, baptism_info, ministries) VALUES \n`;
  sql += memberInserts.join(',\n') + ';\n\n';

  // Generate 100 Children
  const insertedChildren = [];
  const childInserts = [];
  for (let i = 0; i < 100; i++) {
    const isMale = Math.random() > 0.5;
    const childId = uuid();
    insertedChildren.push(childId);
    
    childInserts.push(`(
      '${childId}', ${sqlEscape(randomChoice(isMale ? firstNamesMale : firstNamesFemale))}, ${sqlEscape(randomChoice(lastNames))},
      ${sqlEscape('')}, ${sqlEscape(isMale ? 'male' : 'female')}, ${sqlEscape(generateDate(2010, 2023))},
      ${sqlEscape(randomChoice(zones))}, ${sqlEscape(randomChoice(locations))}, 'active', ${sqlEscape(generateDate(2020, 2024))}
    )`);
  }

  sql += `-- Insert Children Members\n`;
  sql += `INSERT INTO children_members (id, first_name, last_name, other_names, gender, date_of_birth, zone, residence_location, status, join_date) VALUES \n`;
  sql += childInserts.join(',\n') + ';\n\n';

  // Link children to parents
  const parentLinks = [];
  for (const childId of insertedChildren) {
    const parent1 = randomChoice(insertedMembers);
    parentLinks.push(`(
      ${sqlEscape(childId)}, 'mother', ${sqlEscape(randomChoice(firstNamesFemale))}, ${sqlEscape(randomChoice(lastNames))}, true, ${sqlEscape(parent1.id)}
    )`);
    
    if (Math.random() > 0.5) {
      const parent2 = randomChoice(insertedMembers);
      parentLinks.push(`(
        ${sqlEscape(childId)}, 'father', ${sqlEscape(randomChoice(firstNamesMale))}, ${sqlEscape(randomChoice(lastNames))}, true, ${sqlEscape(parent2.id)}
      )`);
    }
  }

  sql += `-- Insert Child Parent Links\n`;
  sql += `INSERT INTO children_member_parents (child_member_id, relationship, first_name, last_name, is_linked, linked_member_id) VALUES \n`;
  sql += parentLinks.join(',\n') + ';\n\n';

  // Generate 50 Visitors
  const visitorsList = [];
  for (let i = 0; i < 50; i++) {
    const isMale = Math.random() > 0.5;
    visitorsList.push(`(
      ${sqlEscape(randomChoice(isMale ? firstNamesMale : firstNamesFemale))}, ${sqlEscape(randomChoice(lastNames))}, 
      ${sqlEscape(generatePhone())}, ${sqlEscape(isMale ? 'male' : 'female')}, ${sqlEscape(randomChoice(locations))}, 
      ${sqlEscape(generateDate(2023, 2024))}, ${sqlEscape(randomChoice(['Sunday Morning Service', 'Wednesday Teaching Status', 'Special Program']))}, 
      ${sqlEscape(randomChoice(['pending', 'contacted', 'scheduled', 'completed']))}
    )`);
  }

  sql += `-- Insert Visitors\n`;
  sql += `INSERT INTO visitors (first_name, last_name, phone, gender, residence_location, visit_date, service_type, follow_up_status) VALUES \n`;
  sql += visitorsList.join(',\n') + ';\n\n';

  fs.writeFileSync('seed.sql', sql);
  console.log('Seed SQL generation completed successfully. Output written to seed.sql!');
}

runSeed().catch(console.error);
