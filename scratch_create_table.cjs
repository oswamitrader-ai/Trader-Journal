const { Client } = require('pg');

const ref = 'mreykdrbyfrwqovsleqi';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZXlrZHJieWZyd3FvdnNsZXFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTUwNDU1NywiZXhwIjoyMTA1MDgwNTU3fQ.jFaxN67eNfjCG_OJKKdwG7srYFMEGU10HlUA8Aoqk5Q';

async function tryPooler() {
  const client = new Client({
    host: 'aws-0-sa-east-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: `postgres.${ref}`,
    password: serviceKey,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    console.log(`SUCCESS connected to pooler!`);
    const res = await client.query('SELECT current_database();');
    console.log('Result:', res.rows);
    await client.end();
  } catch (err) {
    console.log(`Failed on pooler:`, err.message);
  }
}

tryPooler();
