const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mreykdrbyfrwqovsleqi.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log('--- SUPABASE AUDIT ---');
  const users = await supabaseAdmin.from('system_users').select('*');
  console.log('system_users:', users);

  const trades = await supabaseAdmin.from('trades').select('*');
  console.log('trades count:', trades.data?.length, trades.error);

  const settings = await supabaseAdmin.from('risk_settings').select('*');
  console.log('risk_settings:', settings.data, settings.error);
}

main();
