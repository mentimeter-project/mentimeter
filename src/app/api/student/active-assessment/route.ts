import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const assessmentRes = await query(
    'SELECT * FROM assessments WHERE is_active = 1 LIMIT 1'
  );
  const assessment = assessmentRes.rows[0] as Record<string, unknown> | undefined;

  if (!assessment) {
    return NextResponse.json({ assessment: null, questions: [], answeredMap: {}, questionTemplates: {} });
  }

  const questionsRes = await query(
    'SELECT id, question_text, question_type, code_mode, function_name, max_marks, order_index FROM questions WHERE assessment_id = $1 ORDER BY order_index ASC',
    [assessment.id as number]
  );
  const questions = questionsRes.rows;

  const existingResponsesRes = await query(`
    SELECT r.question_id, r.answer_text, r.marks_awarded, r.reviewed
    FROM responses r
    JOIN questions q ON r.question_id = q.id
    WHERE r.student_id = $1 AND q.assessment_id = $2
  `, [session.userId, assessment.id as number]);
  const existingResponses = existingResponsesRes.rows as { question_id: number; answer_text: string; marks_awarded: number | null; reviewed: number }[];

  const answeredMap: Record<number, { answer_text: string; marks_awarded: number | null; reviewed: number }> = {};
  existingResponses.forEach(r => {
    answeredMap[r.question_id] = {
      answer_text: r.answer_text,
      marks_awarded: r.marks_awarded,
      reviewed: r.reviewed,
    };
  });

  // Fetch starter code templates for function-mode questions
  const templateRowsRes = await query(`
    SELECT qt.question_id, qt.language_id, qt.starter_code
    FROM question_templates qt
    JOIN questions q ON qt.question_id = q.id
    WHERE q.assessment_id = $1 AND q.code_mode = 'function'
  `, [assessment.id as number]);
  const templateRows = templateRowsRes.rows as { question_id: number; language_id: number; starter_code: string }[];

  const questionTemplates: Record<number, Record<number, string>> = {};
  for (const row of templateRows) {
    if (!questionTemplates[row.question_id]) questionTemplates[row.question_id] = {};
    questionTemplates[row.question_id][row.language_id] = row.starter_code;
  }

  return NextResponse.json({ assessment, questions, answeredMap, questionTemplates });
}
