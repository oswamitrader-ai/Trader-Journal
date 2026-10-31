const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mreykdrbyfrwqovsleqi.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
