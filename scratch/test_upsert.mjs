import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpsert() {
  const payload2 = {
    id: 'test_upsert_2',
    initialCapital: 100,
    dailyProfitTarget: 100,
    dailyLossLimit: 100,
    risk_lock_until: '2026-10-01T00:00:00Z',
    updated_at: new Date().toISOString()
  };

  console.log('Testing payload without notes but WITH risk_lock_until...');
  const { error: error2 } = await supabase.from('risk_settings').upsert(payload2);
  if (error2) {
    console.error('ERROR UPSERTING risk_lock_until:', error2);
  } else {
    console.log('SUCCESS UPSERTING risk_lock_until!');
  }
}

testUpsert();
