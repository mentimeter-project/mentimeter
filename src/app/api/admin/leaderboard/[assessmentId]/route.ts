import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET(_req: NextRequest, { params }: { params: { assessmentId: string } }) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const aId = parseInt(params.assessmentId);

  const leaderboard = db.prepare(`
    SELECT
      s.name, s.usn,
      COUNT(CASE WHEN r.answer_text != '' THEN 1 END) as answered,
      COALESCE(SUM(r.marks_awarded), 0) as score,
      (SELECT COUNT(*) FROM questions WHERE assessment_id = ?) as total_questions,
      (SELECT SUM(max_marks) FROM questions WHERE assessment_id = ?) as total_marks
    FROM students s
    LEFT JOIN responses r ON r.student_id = s.id
    LEFT JOIN questions q ON r.question_id = q.id AND q.assessment_id = ?
    GROUP BY s.id
    ORDER BY score DESC, answered DESC
  `).all(aId, aId, aId);

  return NextResponse.json({ leaderboard });
}
