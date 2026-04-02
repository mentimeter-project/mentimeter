import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import db from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { assessmentId: string } }
) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.userId || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const aId = parseInt(params.assessmentId);

  const students = db.prepare(`
    SELECT
      s.id,
      s.name,
      s.usn,
      (SELECT COUNT(*) FROM questions WHERE assessment_id = ?) as total_questions,
      COUNT(DISTINCT CASE WHEN r.answer_text != '' THEN r.question_id END) as answered,
      (SELECT COUNT(*) FROM violations WHERE student_id = s.id AND assessment_id = ?) as tab_switches,
      MAX(r.submitted_at) as last_activity
    FROM students s
    LEFT JOIN responses r ON r.student_id = s.id
    LEFT JOIN questions q ON r.question_id = q.id AND q.assessment_id = ?
    GROUP BY s.id
    ORDER BY last_activity DESC NULLS LAST
  `).all(aId, aId, aId);

  return NextResponse.json({ students });
}
