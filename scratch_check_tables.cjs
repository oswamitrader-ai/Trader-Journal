const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mreykdrbyfrwqovsleqi.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const tablesToTest = [
  'users',
  'system_users',
  'profiles',
  'trader_users',
  'user_settings',
  'app_users',
  'accounts',
  'auth_users',
  'risk_settings',
  'trades'
];

async function main() {
  for (const table of tablesToTest) {
    const { data, error } = await supabaseAdmin.from(table).select('*').limit(1);
    if (!error) {
      console.log(`✅ TABLE EXISTS: '${table}' (Rows: ${data?.length})`);
    } else {
      console.log(`❌ Table '${table}' failed:`, error.message);
    }
  }
}

main();
