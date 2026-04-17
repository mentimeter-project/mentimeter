import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';
import { generateAllTemplates } from '@/lib/driver-templates';

interface TestCaseInput {
  input: string;
  expected_output: string;
  marks: number;
}

interface QuestionInput {
  question_text: string;
  question_type?: 'text' | 'code';
  code_mode?: 'stdin' | 'function';
  function_name?: string;
  max_marks?: number;
  test_cases?: TestCaseInput[];
}

/**
 * Sanitise and validate a function name submitted by the admin.
 *
 * Accepts:  "groupAnagrams", "two_sum", "_helper"
 * Auto-fixes: "def groupAnagrams(...)" → "groupAnagrams"
 *             "function groupAnagrams(...)" → "groupAnagrams"
 *             "groupAnagrams(strs)" → "groupAnagrams"
 * Rejects:  anything that still has spaces/parens/colons after stripping
 */
function sanitiseFunctionName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  let name = raw.trim();

  // Strip leading language keywords (copy-paste from LeetCode/IDE)
  name = name.replace(/^(def|function)\s+/, '');

  // Strip trailing call syntax: "foo(args, ...)" → "foo"
  name = name.replace(/\s*\(.*$/, '');

  // Final trim
  name = name.trim();

  // Must be a valid identifier: [A-Za-z_][A-Za-z0-9_]*
  const VALID_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
  if (!VALID_IDENTIFIER.test(name)) {
    return {
      ok: false,
      error:
        `Invalid function_name "${name}". Must be a plain identifier like "twoSum" or ` +
        `"group_anagrams" — no parentheses, spaces, type hints, colons, or return types allowed.`,
    };
  }

  return { ok: true, name };
}

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { title, description, duration_minutes, questions } = await req.json() as {
    title: string;
    description?: string;
    duration_minutes?: number;
    questions: QuestionInput[];
  };

  if (!title || !questions?.length) return NextResponse.json({ error: 'Title and questions required' }, { status: 400 });

  // ── Pre-validate all questions before touching the DB ──────────────────────
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qType = q.question_type || 'text';
    const codeMode = qType === 'code' ? (q.code_mode || 'stdin') : 'stdin';

    if (codeMode === 'function') {
      if (!q.function_name?.trim()) {
        return NextResponse.json(
          { error: `Question ${i + 1}: function_name is required for function-mode questions.` },
          { status: 400 }
        );
      }
      const sanitised = sanitiseFunctionName(q.function_name);
      if (!sanitised.ok) {
        return NextResponse.json({ error: `Question ${i + 1}: ${sanitised.error}` }, { status: 400 });
      }
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const client = await pool.connect();
  let assessmentId: number;
  try {
    await client.query('BEGIN');
    
    const assessmentRes = await client.query(
      'INSERT INTO assessments (title, description, duration_minutes, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
      [title, description || '', duration_minutes || 30, session.userId]
    );
    assessmentId = assessmentRes.rows[0].id;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      let dbQuestionType = 'text';
      if (q.question_type === 'code') {
        dbQuestionType = q.code_mode === 'function' ? 'code_function' : 'code_stdin';
      }

      let functionName: string | null = null;
      if (dbQuestionType === 'code_function' && q.function_name?.trim()) {
        const sanitised = sanitiseFunctionName(q.function_name);
        functionName = sanitised.ok ? sanitised.name : null;
      }

      const qResult = await client.query(
        'INSERT INTO questions (assessment_id, question_text, question_type, function_name, max_marks, order_index) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [assessmentId, q.question_text, dbQuestionType, functionName, q.max_marks || 10, i]
      );
      const questionId = qResult.rows[0].id;

      if (dbQuestionType === 'code_function' && functionName) {
        const allTemplates = generateAllTemplates(functionName);
        for (const [langId, tmpl] of Object.entries(allTemplates)) {
          await client.query(
            'INSERT INTO question_templates (question_id, language_id, starter_code, driver_code) VALUES ($1, $2, $3, $4)',
            [questionId, Number(langId), tmpl.starterCode, tmpl.driverCode]
          );
        }
      }

      if (qType === 'code' && Array.isArray(q.test_cases)) {
        for (const tc of q.test_cases) {
          if (tc.expected_output?.trim()) {
            await client.query(
              'INSERT INTO test_cases (question_id, input, expected_output, marks) VALUES ($1, $2, $3, $4)',
              [questionId, tc.input || '', tc.expected_output.trim(), tc.marks || 1]
            );
          }
        }
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return NextResponse.json({ success: true, assessmentId });
}
