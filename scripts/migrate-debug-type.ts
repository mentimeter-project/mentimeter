/**
 * Migration: Add debug question type support
 *
 * Adds two columns to the `questions` table:
 *   - debug_expected_output TEXT       — the answer admin sets
 *   - debug_case_sensitive  INTEGER    — 1 = strict (default), 0 = case-insensitive
 *
 * Run once: npx tsx scripts/migrate-debug-type.ts
 */

import pool from '../src/lib/db';

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add debug_expected_output column if not present
    await client.query(`
      ALTER TABLE questions
      ADD COLUMN IF NOT EXISTS debug_expected_output TEXT;
    `);

    // Add debug_case_sensitive column (default 1 = strict)
    await client.query(`
      ALTER TABLE questions
      ADD COLUMN IF NOT EXISTS debug_case_sensitive INTEGER NOT NULL DEFAULT 1;
    `);

    await client.query('COMMIT');
    console.log('✅ Migration complete: debug columns added to questions table.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
