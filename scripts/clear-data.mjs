import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Utility to parse .env file since dotenv might not be installed
function loadEnv() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([^#\s][^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("🚨 ERROR: Missing VITE_SUPABASE_SERVICE_ROLE_KEY in your .env file.");
  console.error("The standard anon key will not work because Row Level Security (RLS) blocks the deletes.");
  console.error("Please add VITE_SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> to your .env file and run again.");
  console.error("You can find this key in your Supabase Dashboard -> Project Settings -> API.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearData() {
  console.log("Starting data clearance...");

  const DUMMY_UUID = '00000000-0000-0000-0000-000000000000'; // Supabase SDK requires filter for delete

  try {
    // 1. Unlink Service Records to avoid foreign key constraints from blocking deletions
    console.log("Unlinking service_records...");
    await supabase.from('service_records').update({
        attendance_record_id: null,
        giving_record_id: null
    }).neq('id', DUMMY_UUID).throwOnError();

    // 2. Clear Children Data
    console.log("Clearing children attendance...");
    await supabase.from('children_attendance_entries').delete().neq('id', DUMMY_UUID).throwOnError();
    await supabase.from('children_attendance_records').delete().neq('id', DUMMY_UUID).throwOnError();
    
    console.log("Clearing children givings...");
    await supabase.from('children_giving_records').delete().neq('id', DUMMY_UUID).throwOnError();
    
    console.log("Clearing children visitors...");
    await supabase.from('children_visitor_guardians').delete().neq('id', DUMMY_UUID).throwOnError();
    await supabase.from('children_visitors').delete().neq('id', DUMMY_UUID).throwOnError();

    // 3. Clear Adult Data
    console.log("Clearing expenses...");
    await supabase.from('expense_records').delete().neq('id', DUMMY_UUID).throwOnError();

    console.log("Clearing giving records...");
    await supabase.from('giving_records').delete().neq('id', DUMMY_UUID).throwOnError();

    console.log("Clearing attendance entries, absentees & records...");
    await supabase.from('attendance_entries').delete().neq('id', DUMMY_UUID).throwOnError();
    await supabase.from('absentee_records').delete().neq('id', DUMMY_UUID).throwOnError();
    await supabase.from('attendance_records').delete().neq('id', DUMMY_UUID).throwOnError();

    console.log("Clearing visitors...");
    await supabase.from('visitors').delete().neq('id', DUMMY_UUID).throwOnError();

    // If you also want to clear out the main tracking service_records:
    console.log("Clearing service setups...");
    await supabase.from('service_setups').delete().neq('id', DUMMY_UUID).throwOnError();

    console.log("Clearing service records...");
    await supabase.from('service_records').delete().neq('id', DUMMY_UUID).throwOnError();

    console.log("All requested data cleared successfully! 🎉");
  } catch (err) {
    console.error("Error clearing data:", err.message || err);
  }
}

clearData();
