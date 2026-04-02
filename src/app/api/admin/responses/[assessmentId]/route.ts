import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET(_req: NextRequest, { params }: { params: { assessmentId: string } }) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const aId = parseInt(params.assessmentId);

  const questions = db.prepare('SELECT * FROM questions WHERE assessment_id = ? ORDER BY order_index').all(aId) as {
    id: number; question_text: string; max_marks: number; order_index: number;
  }[];

  const results = questions.map(q => {
    const responses = db.prepare(`
      SELECT r.*, s.name as student_name, s.usn
      FROM responses r
      JOIN students s ON r.student_id = s.id
      WHERE r.question_id = ?
      ORDER BY r.submitted_at ASC
    `).all(q.id);
    return { ...q, responses };
  });

  return NextResponse.json({ results });
}
