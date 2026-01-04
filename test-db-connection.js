// Quick test to verify database connection
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://szligatlxwpcknwkhdyp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6bGlnYXRseHdwY2tud2toZHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MjU5ODMsImV4cCI6MjA3NzEwMTk4M30.RosqdbxrZrdra_KM3HKmXYHnt1owY0t-VSoJ68L0tHY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  console.log('Testing Supabase connection...\n');

  // Test 1: Check if profiles table exists
  console.log('Test 1: Fetching profiles table...');
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .limit(5);

  if (profilesError) {
    console.error('❌ Profiles error:', profilesError.message);
  } else {
    console.log('✅ Profiles table accessible. Found', profiles.length, 'profiles');
    console.log(profiles);
  }

  // Test 2: Check if members table exists
  console.log('\nTest 2: Fetching members table...');
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('*')
    .limit(5);

  if (membersError) {
    console.error('❌ Members error:', membersError.message);
  } else {
    console.log('✅ Members table accessible. Found', members.length, 'members');
    console.log(members);
  }

  // Test 3: Check if attendance_records table exists
  console.log('\nTest 3: Fetching attendance_records table...');
  const { data: attendance, error: attendanceError } = await supabase
    .from('attendance_records')
    .select('*')
    .limit(5);

  if (attendanceError) {
    console.error('❌ Attendance error:', attendanceError.message);
  } else {
    console.log('✅ Attendance table accessible. Found', attendance.length, 'records');
  }

  console.log('\n✨ Database connection test complete!');
}

testConnection();
