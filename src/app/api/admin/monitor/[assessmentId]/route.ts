import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET(_req: NextRequest, { params }: { params: { assessmentId: string } }) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const aId = parseInt(params.assessmentId);

  const totalQuestionsRes = await query(
    'SELECT COUNT(*) as count FROM questions WHERE assessment_id = $1',
    [aId]
  );
  const totalQuestions = parseInt(totalQuestionsRes.rows[0].count, 10) || 0;

  const studentsRes = await query(`
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
    LEFT JOIN questions q ON r.question_id = q.id AND q.assessment_id = $1
    GROUP BY s.id
    ORDER BY answered DESC, last_activity DESC
  `, [aId]);
  const students = studentsRes.rows as { id: number; name: string; usn: string; answered: string; tab_switches: string | null; last_activity: string | null }[];

  const result = students.map(s => ({
    ...s,
    answered: parseInt(s.answered, 10) || 0,
    total_questions: totalQuestions,
    tab_switches: s.tab_switches ? parseInt(s.tab_switches, 10) : 0,
  }));

  return NextResponse.json({ students: result });
}
