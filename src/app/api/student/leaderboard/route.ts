import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const assessment = db.prepare(
    'SELECT * FROM assessments WHERE is_active = 1 LIMIT 1'
  ).get() as Record<string, unknown> | undefined;

  if (!assessment) {
    return NextResponse.json({ leaderboard: [], currentUser: session.name, assessmentActive: false });
  }

  const totalQuestions = (db.prepare(
    'SELECT COUNT(*) as count FROM questions WHERE assessment_id = ?'
  ).get(assessment.id as number) as { count: number }).count;

  const totalMarks = (db.prepare(
    'SELECT COALESCE(SUM(max_marks), 0) as total FROM questions WHERE assessment_id = ?'
  ).get(assessment.id as number) as { total: number }).total;

  const leaderboard = db.prepare(`
    SELECT
      s.name,
      s.usn,
      COUNT(CASE WHEN r.answer_text != '' THEN 1 END) as answered,
      COALESCE(SUM(CASE WHEN r.reviewed = 1 THEN r.marks_awarded ELSE 0 END), 0) as score
    FROM students s
    INNER JOIN responses r ON r.student_id = s.id
    INNER JOIN questions q ON r.question_id = q.id AND q.assessment_id = ?
    WHERE r.answer_text != ''
    GROUP BY s.id
    ORDER BY score DESC, answered DESC, MIN(r.submitted_at) ASC
  `).all(assessment.id as number) as { name: string; usn: string; answered: number; score: number }[];

  const result = leaderboard.map(s => ({
    ...s,
    total_questions: totalQuestions,
    total_marks: totalMarks,
  }));

  return NextResponse.json({
    leaderboard: result,
    currentUser: session.name,
    assessmentActive: true,
  });
}
