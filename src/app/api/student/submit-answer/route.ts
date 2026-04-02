import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'student') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { questionId, answerText, selectedAnswer } = await req.json();
  const text = answerText || selectedAnswer || '';

  db.prepare(
    'INSERT OR REPLACE INTO responses (student_id, question_id, answer_text) VALUES (?, ?, ?)'
  ).run(session.userId, questionId, text);

  return NextResponse.json({ success: true });
}
