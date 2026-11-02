// Offline regression checks: no credentials, network calls, or real data mutations.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const rows = new Map();
const deletions = [];
const columns = new Set(['id', 'initialCapital', 'dailyProfitTarget', 'dailyLossLimit', 'monthlyProfitTarget', 'monthlyLossLimit', 'maxTradesPerDay', 'alertSoundEnabled', 'updated_at']);
const client = {
  channel: () => ({ send: () => Promise.resolve() }),
  from(table) {
    return {
      async upsert(row) {
        if (table === 'risk_settings') for (const key of Object.keys(row)) assert(columns.has(key), `Unknown risk_settings column: ${key}`);
        rows.set(table, row);
        return { error: null };
      },
      select() { return { eq: () => ({ maybeSingle: async () => ({ data: rows.get(table), error: null }) }) }; },
      delete() { return { in: (field, ids) => ({ eq: async (ownerField, owner) => {
        deletions.push({ table, field, ids, ownerField, owner });
        return { error: null };
      } }) }; },
    };
  },
};
const compiled = buildSync({ entryPoints: [require('node:path').resolve(__dirname, '../src/lib/supabase.ts')], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, define: { 'import.meta.env': '{}' } });
const mod = { exports: {} };
vm.runInNewContext(compiled.outputFiles[0].text, { module: mod, exports: mod.exports, require: name => name === '@supabase/supabase-js' ? { createClient: () => client } : require(name), console });
(async () => {
  const api = mod.exports;
  const settings = { initialCapital: 123, dailyProfitTarget: 10, dailyLossLimit: 5, monthlyProfitTarget: 100, monthlyLossLimit: 50, maxTradesPerDay: 3, alertSoundEnabled: true, antiFuriaCustomWindowEnabled: true, antiFuriaStartTime: '09:15', antiFuriaEndTime: '12:45' };
  assert.equal((await api.saveRiskSettingsToSupabase(settings, ' Trader@Example.com ')).success, true);
  const loaded = await api.fetchRiskSettingsFromSupabase('trader@example.com');
  assert.equal(loaded.error, null);
  for (const [key, value] of Object.entries(settings)) assert.equal(loaded.data[key], value, key);
  const trades = new Set(Array.from({ length: 58 }, (_, i) => `trade-${i}`));
  const capital = new Set(Array.from({ length: 351 }, (_, i) => `capital-${i}`));
  assert.equal(await api.purgeCloudRecordsDeletedByUser(' Trader@Example.com ', trades, capital), null);
  assert.equal(deletions.length, 10);
  for (const deletion of deletions) {
    assert.equal(deletion.ownerField, 'user_email');
    assert.equal(deletion.owner, 'trader@example.com');
    assert(deletion.ids.length <= 50);
  }
  for (const [table, expected] of [['trades', trades], ['capital_transactions', capital]]) {
    const actual = deletions.filter(d => d.table === table).flatMap(d => d.ids);
    assert.equal(actual.length, expected.size);
    assert.deepEqual(new Set(actual), expected);
  }
  assert.equal(await api.purgeCloudRecordsDeletedByUser('trader@example.com', new Set(), new Set()), null);
  assert.equal(deletions.length, 10);
  assert(await api.purgeCloudRecordsDeletedByUser('', trades, capital));
  assert.equal(deletions.length, 10);
  console.log('PASS: settings match database columns and preserve values; 409 deletions use 10 owner-scoped batches; empty/anonymous batches make no requests.');
})().catch(error => { console.error(error); process.exitCode = 1; });
