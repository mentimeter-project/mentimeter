import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';
import { evaluateDebugAnswer } from '@/lib/debug-evaluator';

/**
 * POST /api/student/evaluate-debug
 *
 * Body: { questionId: number; answerText: string }
 *
 * Evaluates a debug-type answer against the stored expected output,
 * persists the result, and returns the evaluation summary in the
 * same format used by the code evaluation pipeline.
 */
export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: { questionId?: number; answerText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { questionId, answerText } = body;

  if (!questionId) {
    return NextResponse.json({ error: 'questionId is required' }, { status: 400 });
  }
  if (!answerText?.trim()) {
    return NextResponse.json({ error: 'Answer cannot be empty' }, { status: 400 });
  }

  // ── Fetch question ──────────────────────────────────────────────────────────
  const qRes = await query(
    `SELECT q.id, q.question_type, q.max_marks, q.debug_expected_output, q.debug_case_sensitive,
            a.is_active
     FROM questions q
     JOIN assessments a ON q.assessment_id = a.id
     WHERE q.id = $1`,
    [questionId],
  );
  const q = qRes.rows[0] as {
    id: number;
    question_type: string;
    max_marks: number;
    debug_expected_output: string | null;
    debug_case_sensitive: number; // SQLite stores booleans as integers
    is_active: number;
  } | undefined;

  if (!q) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  }
  if (q.question_type !== 'debug') {
    return NextResponse.json({ error: 'Question is not a debug type' }, { status: 400 });
  }
  if (!q.is_active) {
    return NextResponse.json({ error: 'Assessment is no longer active' }, { status: 400 });
  }
  if (!q.debug_expected_output) {
    return NextResponse.json({ error: 'No expected output configured for this question' }, { status: 500 });
  }

  // ── Prevent re-submission ────────────────────────────────────────────────────
  const existingRes = await query(
    'SELECT id, answer_text FROM responses WHERE student_id = $1 AND question_id = $2',
    [session.userId, questionId],
  );
  const existing = existingRes.rows[0] as { id: number; answer_text: string } | undefined;
  if (existing?.answer_text) {
    return NextResponse.json({ error: 'Answer already submitted', alreadySubmitted: true }, { status: 400 });
  }

  // ── Evaluate ─────────────────────────────────────────────────────────────────
  const evalResult = evaluateDebugAnswer(
    answerText.trim(),
    q.debug_expected_output,
    q.max_marks,
    { caseSensitive: q.debug_case_sensitive !== 0 },
  );

  // ── Persist response + auto-award marks ──────────────────────────────────────
  // Debug answers are auto-reviewed (no manual grading needed).
  await query(
    `INSERT INTO responses (student_id, question_id, answer_text, reviewed, marks_awarded)
     VALUES ($1, $2, $3, 1, $4)
     ON CONFLICT (student_id, question_id)
     DO UPDATE SET answer_text = $3, reviewed = 1, marks_awarded = $4`,
    [session.userId, questionId, answerText.trim(), evalResult.marks],
  );

  return NextResponse.json({
    status: evalResult.status,
    marks: evalResult.marks,
    maxMarks: evalResult.maxMarks,
    message: evalResult.message,
  });
}
