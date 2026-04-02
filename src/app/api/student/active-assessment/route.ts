import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'student') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const assessment = db.prepare('SELECT * FROM assessments WHERE is_active = 1 LIMIT 1').get() as Record<string, unknown> | undefined;

  if (!assessment) return NextResponse.json({ assessment: null });

  const questions = db.prepare(
    'SELECT id, question_text, max_marks, order_index FROM questions WHERE assessment_id = ? ORDER BY order_index'
  ).all(assessment.id as number);

  const responses = db.prepare(
    'SELECT question_id, answer_text, marks_awarded, reviewed FROM responses WHERE student_id = ?'
  ).all(session.userId) as { question_id: number; answer_text: string; marks_awarded: number | null; reviewed: number }[];

  const answeredMap: Record<number, { answer_text: string; marks_awarded: number | null; reviewed: number }> = {};
  responses.forEach(r => { answeredMap[r.question_id] = r; });

  return NextResponse.json({ assessment, questions, answeredMap });
}
