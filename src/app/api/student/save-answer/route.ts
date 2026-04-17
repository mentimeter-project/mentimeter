import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { questionId, answerText } = body;

  if (!questionId) {
    return NextResponse.json({ error: 'Question ID required' }, { status: 400 });
  }

  if (!answerText?.trim()) {
    return NextResponse.json({ error: 'Answer cannot be empty' }, { status: 400 });
  }

  const questionRes = await query('SELECT * FROM questions WHERE id = $1', [questionId]);
  const question = questionRes.rows[0] as { assessment_id: number } | undefined;
  if (!question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  }

  const assessmentRes = await query(
    'SELECT is_active FROM assessments WHERE id = $1',
    [question.assessment_id]
  );
  const assessment = assessmentRes.rows[0] as { is_active: number } | undefined;

  if (!assessment?.is_active) {
    return NextResponse.json({ error: 'Assessment is no longer active' }, { status: 400 });
  }

  const existingRes = await query(
    'SELECT id, answer_text FROM responses WHERE student_id = $1 AND question_id = $2',
    [session.userId, questionId]
  );
  const existing = existingRes.rows[0] as { id: number; answer_text: string } | undefined;

  if (existing?.answer_text) {
    return NextResponse.json({ error: 'Answer already submitted', alreadySubmitted: true }, { status: 400 });
  }

  await query(
    'INSERT INTO responses (student_id, question_id, answer_text, reviewed, marks_awarded) VALUES ($1, $2, $3, 0, NULL) ON CONFLICT (student_id, question_id) DO UPDATE SET answer_text = $3, reviewed = 0, marks_awarded = NULL',
    [session.userId, questionId, answerText.trim()]
  );

  return NextResponse.json({ success: true });
}
