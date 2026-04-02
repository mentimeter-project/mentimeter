import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'student') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const assessment = db.prepare('SELECT * FROM assessments WHERE is_active = 1 LIMIT 1').get() as Record<string, unknown> | undefined;

  if (!assessment) return NextResponse.json({ leaderboard: [], currentUser: session.name });

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
    HAVING answered > 0
    ORDER BY score DESC, answered DESC
  `).all(assessment.id as number, assessment.id as number, assessment.id as number);

  return NextResponse.json({ leaderboard, currentUser: session.name });
}
