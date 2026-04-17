import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const assessmentsRes = await query(`
    SELECT
      a.*,
      (SELECT COUNT(*) FROM questions q WHERE q.assessment_id = a.id) as question_count,
      (SELECT COUNT(DISTINCT r.student_id)
        FROM responses r
        JOIN questions q ON r.question_id = q.id
        WHERE q.assessment_id = a.id AND r.answer_text != ''
      ) as response_count,
      (SELECT COUNT(*)
        FROM responses r
        JOIN questions q ON r.question_id = q.id
        WHERE q.assessment_id = a.id AND r.reviewed = 0 AND r.answer_text != ''
      ) as pending_review
    FROM assessments a
    ORDER BY a.created_at DESC
  `);
  const assessments = assessmentsRes.rows;

  return NextResponse.json({ assessments });
}
