const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mreykdrbyfrwqovsleqi.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZXlrZHJieWZyd3FvdnNsZXFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTUwNDU1NywiZXhwIjoyMTA1MDgwNTU3fQ.jFaxN67eNfjCG_OJKKdwG7srYFMEGU10HlUA8Aoqk5Q';

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
