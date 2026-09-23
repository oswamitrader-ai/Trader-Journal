const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mreykdrbyfrwqovsleqi.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZXlrZHJieWZyd3FvdnNsZXFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTUwNDU1NywiZXhwIjoyMTA1MDgwNTU3fQ.jFaxN67eNfjCG_OJKKdwG7srYFMEGU10HlUA8Aoqk5Q';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fixLastTrade() {
  console.log('Fetching latest trades from Supabase...');
  const { data: trades, error } = await supabase
    .from('trades')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching trades:', error);
    return;
  }

  console.log('Latest 10 trades:', JSON.stringify(trades, null, 2));

  if (trades && trades.length > 0) {
    // Target the latest auto-captured trade or trade with PnL > 25.20
    const targetTrade = trades.find(t => t.id.startsWith('auto-') || Number(t.pnl) > 25.20) || trades[0];
    console.log('Target trade to update:', targetTrade);

    if (targetTrade) {
      const { data: updated, error: updateErr } = await supabase
        .from('trades')
        .update({ pnl: 25.20, result: 'GAIN', updated_at: new Date().toISOString() })
        .eq('id', targetTrade.id)
        .select();

      if (updateErr) {
        console.error('Error updating trade PnL:', updateErr);
      } else {
        console.log('✅ Successfully updated trade PnL to R$ 25.20:', updated);
      }
    }
  }
}

fixLastTrade();
