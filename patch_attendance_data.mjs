
const SUPABASE_URL = 'https://szligatlxwpcknwkhdyp.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6bGlnYXRseHdwY2tud2toZHlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTUyNTk4MywiZXhwIjoyMDc3MTAxOTgzfQ.SVrt-g42HzB_-SpbI2fYJwOrsYseohDuE2gFixjLKM0';

const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

async function patchData() {
  // Fetch general attendance records where denominations are 0
  const url = `${SUPABASE_URL}/rest/v1/attendance_records?select=id,total_count&attendance_type=eq.general&men_count=eq.0&women_count=eq.0&limit=10`;
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    console.error('Error fetching data:', await res.text());
    return;
  }
  const records = await res.json();
  console.log(`Found ${records.length} records to patch.`);

  for (const record of records) {
    const total = record.total_count || 50;
    const children = Math.round(total * 0.2);
    const visitors = Math.round(total * 0.1);
    const remaining = total - children - visitors;
    const men = Math.round(remaining * 0.45);
    const women = remaining - men;

    const patchUrl = `${SUPABASE_URL}/rest/v1/attendance_records?id=eq.${record.id}`;
    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        men_count: men,
        women_count: women,
        children_count: children,
        visitors_count: visitors
      })
    });

    if (patchRes.ok) {
      console.log(`Patched record ${record.id}: Men=${men}, Women=${women}, Children=${children}, Visitors=${visitors}`);
    } else {
      console.error(`Failed to patch record ${record.id}:`, await patchRes.text());
    }
  }
  console.log('Patching complete.');
}

patchData().catch(console.error);
