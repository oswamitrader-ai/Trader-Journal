const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mreykdrbyfrwqovsleqi.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZXlrZHJieWZyd3FvdnNsZXFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTUwNDU1NywiZXhwIjoyMTA1MDgwNTU3fQ.jFaxN67eNfjCG_OJKKdwG7srYFMEGU10HlUA8Aoqk5Q';

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  const testPayload = {
    id: 'user_accounts_store',
    initialCapital: 0,
    dailyProfitTarget: 0,
    dailyLossLimit: 0,
    monthlyProfitTarget: 0,
    monthlyLossLimit: 0,
    maxTradesPerDay: 0,
    alertSoundEnabled: false,
    updated_at: new Date().toISOString(),
  };

  console.log('Upserting to risk_settings...');
  const res = await supabaseAdmin.from('risk_settings').upsert(testPayload);
  console.log('Result:', res);

  const fetchRes = await supabaseAdmin.from('risk_settings').select('*').eq('id', 'user_accounts_store');
  console.log('Fetched:', fetchRes.data);
}

main();
