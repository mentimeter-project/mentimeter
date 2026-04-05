import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const assessment = db.prepare(
    'SELECT * FROM assessments WHERE is_active = 1 LIMIT 1'
  ).get() as Record<string, unknown> | undefined;

  if (!assessment) {
    return NextResponse.json({ assessment: null, questions: [], answeredMap: {} });
  }

  const questions = db.prepare(
    'SELECT id, question_text, question_type, max_marks, order_index FROM questions WHERE assessment_id = ? ORDER BY order_index ASC'
  ).all(assessment.id as number);

  const existingResponses = db.prepare(`
    SELECT r.question_id, r.answer_text, r.marks_awarded, r.reviewed
    FROM responses r
    JOIN questions q ON r.question_id = q.id
    WHERE r.student_id = ? AND q.assessment_id = ?
  `).all(session.userId, assessment.id as number) as { question_id: number; answer_text: string; marks_awarded: number | null; reviewed: number }[];

  const answeredMap: Record<number, { answer_text: string; marks_awarded: number | null; reviewed: number }> = {};
  existingResponses.forEach(r => {
    answeredMap[r.question_id] = {
      answer_text: r.answer_text,
      marks_awarded: r.marks_awarded,
      reviewed: r.reviewed,
    };
  });

  return NextResponse.json({ assessment, questions, answeredMap });
}
