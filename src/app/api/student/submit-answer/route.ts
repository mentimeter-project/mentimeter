import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'student') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { questionId, answerText, selectedAnswer } = await req.json();
  const text = answerText || selectedAnswer || '';

  await query(
    'INSERT INTO responses (student_id, question_id, answer_text) VALUES ($1, $2, $3) ON CONFLICT (student_id, question_id) DO UPDATE SET answer_text = $3',
    [session.userId, questionId, text]
  );

  return NextResponse.json({ success: true });
}
