import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { questionId, answerText } = await req.json();

  if (!questionId) {
    return NextResponse.json({ error: 'Question ID required' }, { status: 400 });
  }

  if (!answerText?.trim()) {
    return NextResponse.json({ error: 'Answer cannot be empty' }, { status: 400 });
  }

  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId) as { assessment_id: number } | undefined;
  if (!question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  }

  const assessment = db.prepare(
    'SELECT is_active FROM assessments WHERE id = ?'
  ).get(question.assessment_id) as { is_active: number } | undefined;

  if (!assessment?.is_active) {
    return NextResponse.json({ error: 'Assessment is no longer active' }, { status: 400 });
  }

  const existing = db.prepare(
    'SELECT id, answer_text FROM responses WHERE student_id = ? AND question_id = ?'
  ).get(session.userId, questionId) as { id: number; answer_text: string } | undefined;

  if (existing?.answer_text) {
    return NextResponse.json({ error: 'Answer already submitted', alreadySubmitted: true }, { status: 400 });
  }

  db.prepare(
    'INSERT OR REPLACE INTO responses (student_id, question_id, answer_text, reviewed, marks_awarded) VALUES (?, ?, ?, 0, NULL)'
  ).run(session.userId, questionId, answerText.trim());

  return NextResponse.json({ success: true });
}
