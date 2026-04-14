/**
 * One-shot migration: regenerate question_templates for questions 3 & 4
 * whose starter_code / driver_code were generated with a corrupted function_name.
 *
 * Run: npx tsx scripts/fix-templates.ts
 */
import db from '../src/lib/db';
import { generateAllTemplates } from '../src/lib/driver-templates';

const QUESTION_IDS = [3, 4];

for (const qid of QUESTION_IDS) {
  const question = db
    .prepare(`SELECT id, function_name, code_mode FROM questions WHERE id = ?`)
    .get(qid) as { id: number; function_name: string | null; code_mode: string } | undefined;

  if (!question) {
    console.warn(`Question ${qid} not found — skipping.`);
    continue;
  }

  if (question.code_mode !== 'function' || !question.function_name) {
    console.warn(`Question ${qid} is not function-mode or has no function_name — skipping.`);
    continue;
  }

  const functionName = question.function_name;
  console.log(`Regenerating templates for Q${qid} with function_name="${functionName}"...`);

  const allTemplates = generateAllTemplates(functionName);

  const upsert = db.prepare(`
    INSERT INTO question_templates (question_id, language_id, starter_code, driver_code)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(question_id, language_id) DO UPDATE SET
      starter_code = excluded.starter_code,
      driver_code  = excluded.driver_code
  `);

  const run = db.transaction(() => {
    for (const [langId, tmpl] of Object.entries(allTemplates)) {
      upsert.run(qid, Number(langId), tmpl.starterCode, tmpl.driverCode);
      console.log(`  ✅ Updated template for language_id=${langId}`);
    }
  });

  run();
  console.log(`Q${qid} templates fixed.\n`);
}

console.log('Migration complete.');
