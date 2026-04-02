import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET(_req: NextRequest, { params }: { params: { assessmentId: string } }) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const aId = parseInt(params.assessmentId);

  const totalQuestions = (db.prepare(
    'SELECT COUNT(*) as count FROM questions WHERE assessment_id = ?'
  ).get(aId) as { count: number }).count;

  const students = db.prepare(`
    SELECT
      s.id,
      s.name,
      s.usn,
      COUNT(CASE WHEN r.answer_text != '' THEN 1 END) as answered,
      (SELECT MAX(event_count)
        FROM student_events
        WHERE student_id = s.id AND event_type = 'tab_switch'
      ) as tab_switches,
      MAX(r.submitted_at) as last_activity
    FROM students s
    LEFT JOIN responses r ON r.student_id = s.id
    LEFT JOIN questions q ON r.question_id = q.id AND q.assessment_id = ?
    GROUP BY s.id
    ORDER BY answered DESC, last_activity DESC
  `).all(aId) as { id: number; name: string; usn: string; answered: number; tab_switches: number | null; last_activity: string | null }[];

  const result = students.map(s => ({
    ...s,
    total_questions: totalQuestions,
    tab_switches: s.tab_switches || 0,
  }));

  return NextResponse.json({ students: result });
}
