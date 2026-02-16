
const SUPABASE_URL = 'https://szligatlxwpcknwkhdyp.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6bGlnYXRseHdwY2tud2toZHlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTUyNTk4MywiZXhwIjoyMDc3MTAxOTgzfQ.SVrt-g42HzB_-SpbI2fYJwOrsYseohDuE2gFixjLKM0';

const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

async function checkData() {
  const url = `${SUPABASE_URL}/rest/v1/attendance_records?select=men_count,women_count,children_count,visitors_count&attendance_type=eq.general&limit=10`;
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    const text = await res.text();
    console.error('Error fetching data:', text);
    return;
  }
  const data = await res.json();
  console.log('Total records checked:', data.length);
  const withData = data.filter(r => (r.men_count + r.women_count + r.children_count + r.visitors_count) > 0);
  console.log('Records with denominations > 0:', withData.length);
  if (withData.length > 0) {
    console.log('Sample record:', withData[0]);
  } else {
    console.log('No records found with denominations > 0.');
  }
}

checkData().catch(console.error);
