const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mreykdrbyfrwqovsleqi.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZXlrZHJieWZyd3FvdnNsZXFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTUwNDU1NywiZXhwIjoyMTA1MDgwNTU3fQ.jFaxN67eNfjCG_OJKKdwG7srYFMEGU10HlUA8Aoqk5Q';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkBalance() {
  console.log('=== VERIFICANDO CONTA E OPERAÇÕES ===');
  
  // 1. Settings
  const { data: settingsData } = await supabase.from('risk_settings').select('*');
  console.log('\n--- Risk Settings ---');
  console.log(JSON.stringify(settingsData, null, 2));

  // 2. Trades
  const { data: tradesData } = await supabase.from('trades').select('*');
  console.log(`\n--- Trades (${tradesData?.length || 0} encontrados) ---`);

  let totalPnL = 0;
  let realPnL = 0;
  let demoPnL = 0;

  (tradesData || []).forEach(t => {
    const pnl = Number(t.pnl) || 0;
    const isDemo = t.accountType === 'DEMO' || t.isReal === false || (t.tags && t.tags.includes('DEMO'));
    totalPnL += pnl;
    if (isDemo) demoPnL += pnl;
    else realPnL += pnl;

    console.log(`Trade [${t.id}] | Data: ${t.date} | Hora: ${t.time} | Ativo: ${t.asset} | PnL: ${pnl} | Tipo: ${isDemo ? 'DEMO' : 'REAL'}`);
  });

  console.log('\n--- RESUMO DOS TRADES ---');
  console.log(`PnL Total acumulado: R$ ${totalPnL.toFixed(2)}`);
  console.log(`PnL Conta Real: R$ ${realPnL.toFixed(2)}`);
  console.log(`PnL Conta DEMO: R$ ${demoPnL.toFixed(2)}`);

  // 3. Transactions (Deposits / Withdrawals)
  const { data: txData } = await supabase.from('capital_transactions').select('*');
  console.log('\n--- Capital Transactions ---');
  console.log(JSON.stringify(txData, null, 2));
}

checkBalance();
