import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET(_req: NextRequest, { params }: { params: { assessmentId: string } }) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const aId = parseInt(params.assessmentId);

  const questionsRes = await query('SELECT * FROM questions WHERE assessment_id = $1 ORDER BY order_index', [aId]);
  const questions = questionsRes.rows as {
    id: number; question_text: string; max_marks: number; order_index: number;
  }[];

  const results = [];
  for (const q of questions) {
    const responsesRes = await query(`
      SELECT r.*, s.name as student_name, s.usn
      FROM responses r
      JOIN students s ON r.student_id = s.id
      WHERE r.question_id = $1
      ORDER BY r.submitted_at ASC
    `, [q.id]);
    results.push({ ...q, responses: responsesRes.rows });
  }

  return NextResponse.json({ results });
}
