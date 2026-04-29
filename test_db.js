const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:mentimetr1234@db.fshsopjuxcnowyfuhrgt.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
pool.query("ALTER TABLE assessments ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;").then(r => { console.log('success'); process.exit(0); }).catch(console.error);
