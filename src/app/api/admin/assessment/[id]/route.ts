import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';
import { generateAllTemplates } from '@/lib/driver-templates';

function sanitiseFunctionName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  let name = raw.trim();
  name = name.replace(/^(def|function)\s+/, '');
  name = name.replace(/\s*\(.*$/, '');
  name = name.trim();

  const VALID_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
  if (!VALID_IDENTIFIER.test(name)) {
    return { ok: false, error: `Invalid function name: ${name}` };
  }

  return { ok: true, name };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const client = await pool.connect();
  try {
    const { id } = params;
    const assessmentRes = await client.query('SELECT * FROM assessments WHERE id = $1', [id]);
    if (assessmentRes.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const assessment = assessmentRes.rows[0];

    const questionsRes = await client.query('SELECT * FROM questions WHERE assessment_id = $1 ORDER BY order_index', [id]);
    const questions = questionsRes.rows;

    for (const q of questions) {
      if (q.question_type.startsWith('code')) {
        const tcRes = await client.query('SELECT * FROM test_cases WHERE question_id = $1 ORDER BY id', [q.id]);
        q.test_cases = tcRes.rows;
        q.code_mode = q.question_type === 'code_function' ? 'function' : 'stdin';
        q.question_type = 'code';
      } else if (q.question_type === 'debug') {
        q.test_cases = [];
        q.debug_case_sensitive = q.debug_case_sensitive === 1;
      } else {
        q.test_cases = [];
      }
    }

    return NextResponse.json({ assessment, questions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { title, description, duration_minutes, questions } = await req.json();
  const { id } = params;

  if (!title || !questions?.length) {
    return NextResponse.json({ error: 'Title and questions required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const checkRes = await client.query('SELECT is_active FROM assessments WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) throw new Error('Not found');
    if (checkRes.rows[0].is_active === 1) throw new Error('Cannot edit live assessment');

    await client.query(
      'UPDATE assessments SET title = $1, description = $2, duration_minutes = $3 WHERE id = $4',
      [title, description || '', duration_minutes || 30, id]
    );

    // Delete existing questions (will cascade to test_cases and templates, and responses)
    await client.query('DELETE FROM questions WHERE assessment_id = $1', [id]);

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      let dbQuestionType = 'text';
      if (q.question_type === 'code') {
        dbQuestionType = q.code_mode === 'function' ? 'code_function' : 'code_stdin';
      } else if (q.question_type === 'debug') {
        dbQuestionType = 'debug';
      }

      if (dbQuestionType === 'debug' && !q.debug_expected_output?.trim()) {
        throw new Error(`Question ${i + 1} is a debug question but has no expected output.`);
      }

      let functionName: string | null = null;
      if (dbQuestionType === 'code_function' && q.function_name?.trim()) {
        const sanitised = sanitiseFunctionName(q.function_name);
        if (!sanitised.ok) throw new Error(sanitised.error);
        functionName = sanitised.name;
      }

      const qResult = await client.query(
        `INSERT INTO questions
           (assessment_id, question_text, question_type, function_name, max_marks, order_index,
            debug_expected_output, debug_case_sensitive)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          id,
          q.question_text,
          dbQuestionType,
          functionName,
          q.max_marks || 10,
          i,
          dbQuestionType === 'debug' ? q.debug_expected_output!.trim() : null,
          dbQuestionType === 'debug' ? (q.debug_case_sensitive === false ? 0 : 1) : 1,
        ]
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

      if (q.question_type === 'code' && Array.isArray(q.test_cases)) {
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
    return NextResponse.json({ success: true, assessmentId: id });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('EDIT ASSESSMENT ERROR:', err);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  } finally {
    client.release();
  }
}
