const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mreykdrbyfrwqovsleqi.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZXlrZHJieWZyd3FvdnNsZXFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTUwNDU1NywiZXhwIjoyMTA1MDgwNTU3fQ.jFaxN67eNfjCG_OJKKdwG7srYFMEGU10HlUA8Aoqk5Q';

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
