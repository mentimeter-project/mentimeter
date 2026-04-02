import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { title, description, duration_minutes, questions } = await req.json();

  if (!title || !questions?.length) return NextResponse.json({ error: 'Title and questions required' }, { status: 400 });

  const result = db.transaction(() => {
    const assessment = db.prepare(
      'INSERT INTO assessments (title, description, duration_minutes, created_by) VALUES (?, ?, ?, ?)'
    ).run(title, description || '', duration_minutes || 30, session.userId);

    questions.forEach((q: { question_text: string; max_marks?: number }, i: number) => {
      db.prepare(
        'INSERT INTO questions (assessment_id, question_text, max_marks, order_index) VALUES (?, ?, ?, ?)'
      ).run(assessment.lastInsertRowid, q.question_text, q.max_marks || 10, i);
    });

    return assessment.lastInsertRowid;
  })();

  return NextResponse.json({ success: true, assessmentId: result });
}
