const { Pool } = require('pg');

const regions = [
  'aws-0-ap-south-1',
  'aws-0-us-east-1',
  'aws-0-us-west-1',
  'aws-0-eu-west-1',
  'aws-0-ap-southeast-1',
];

async function tryRegion(region) {
  const url = `postgresql://postgres.fshsopjuxcnowyfuhrgt:mentimetr1234@${region}.pooler.supabase.com:5432/postgres`;
  const p = new Pool({ connectionString: url, connectionTimeoutMillis: 6000, ssl: { rejectUnauthorized: false } });
  try {
    await p.query('SELECT 1');
    console.log('SUCCESS:', region);
    return true;
  } catch (e) {
    console.log('FAIL:', region, '-', e.message);
    return false;
  } finally {
    await p.end();
  }
}

(async () => {
  for (const r of regions) {
    const ok = await tryRegion(r);
    if (ok) break;
  }
})();
