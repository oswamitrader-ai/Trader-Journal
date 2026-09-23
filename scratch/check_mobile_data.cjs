const { createClient } = require('@supabase/supabase-js');

const url = 'https://mreykdrbyfrwqovsleqi.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZXlrZHJieWZyd3FvdnNsZXFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MDQ1NTcsImV4cCI6MjEwNTA4MDU1N30.X8JibBnbQh47nkHv51srbAWrdHZDLojs1xVupV3og1g';

const sb = createClient(url, key);

(async () => {
  // Get today in local timezone
  const now = new Date();
  const todayStr = now.toLocaleDateString('sv-SE'); // YYYY-MM-DD in local tz
  console.log('=== DATA HOJE (local) ===', todayStr);

  // 1. Check trades for today
  const { data: todayTrades, error: e1 } = await sb
    .from('trades')
    .select('id, date, pnl, result, accountType, isReal, user_email, asset')
    .eq('date', todayStr)
    .order('created_at', { ascending: false });

  console.log('\n=== TRADES HOJE ===');
  if (e1) console.error('Erro trades:', e1);
  else if (!todayTrades || todayTrades.length === 0) {
    console.log('Nenhum trade encontrado para hoje:', todayStr);
  } else {
    todayTrades.forEach(t => console.log(JSON.stringify(t)));
  }

  // 2. Check recent trades (all dates)
  const { data: recentTrades, error: e2 } = await sb
    .from('trades')
    .select('id, date, pnl, result, accountType, isReal, user_email, asset')
    .order('date', { ascending: false })
    .limit(15);

  console.log('\n=== ÚLTIMOS 15 TRADES (qualquer data) ===');
  if (e2) console.error('Erro:', e2);
  else recentTrades?.forEach(t => console.log(JSON.stringify(t)));

  // 3. Check risk_settings
  const { data: settings, error: e3 } = await sb
    .from('risk_settings')
    .select('*')
    .limit(5);

  console.log('\n=== RISK SETTINGS ===');
  if (e3) console.error('Erro:', e3);
  else settings?.forEach(s => console.log(JSON.stringify(s)));

  // 4. Check columns of trades table
  const { data: sample } = await sb
    .from('trades')
    .select('*')
    .limit(1);

  if (sample && sample.length > 0) {
    console.log('\n=== COLUNAS DA TABELA TRADES ===');
    console.log(Object.keys(sample[0]).join(', '));
  }
})();
