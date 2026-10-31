const { Client } = require('pg');

const ref = 'mreykdrbyfrwqovsleqi';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
