const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mreykdrbyfrwqovsleqi.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZXlrZHJieWZyd3FvdnNsZXFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTUwNDU1NywiZXhwIjoyMTA1MDgwNTU3fQ.jFaxN67eNfjCG_OJKKdwG7srYFMEGU10HlUA8Aoqk5Q';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function seed() {
  console.log('Seeding initial data into Supabase...');

  // Seed default admin in risk_settings backup store if system_users table is not yet created
  const initialUsers = [
    {
      id: 'usr-admin-001',
      email: 'oswamitrader@gmail.com',
      name: 'Swami Trader (Admin)',
      role: 'ADMIN',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      password: 'admin123'
    }
  ];

  // Try upserting to system_users table if it exists
  const { error: userErr } = await supabase.from('system_users').upsert(initialUsers);
  if (userErr) {
    console.log('Note: system_users table missing (PGRST205), storing backup in risk_settings.');
  } else {
    console.log('✅ Default admin inserted into system_users table!');
  }

  // Backup in risk_settings table
  const backupPayload = {
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

  const { error: backupErr } = await supabase.from('risk_settings').upsert(backupPayload);
  if (!backupErr) {
    console.log('✅ User store backup initialized in risk_settings!');
  }
}

seed();
