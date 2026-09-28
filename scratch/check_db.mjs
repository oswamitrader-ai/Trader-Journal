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

async function check() {
  console.log('Fetching risk_settings...');
  const { data, error } = await supabase.from('risk_settings').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Total rows:', data?.length);
    console.log('Rows:', JSON.stringify(data, null, 2));
  }
}

check();
