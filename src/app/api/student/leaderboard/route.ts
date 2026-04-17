import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const assessmentRes = await query(
    'SELECT * FROM assessments WHERE is_active = 1 LIMIT 1'
  );
  const assessment = assessmentRes.rows[0] as Record<string, unknown> | undefined;

  if (!assessment) {
    return NextResponse.json({ leaderboard: [], currentUser: session.name, assessmentActive: false });
  }

  const totalQuestionsRes = await query(
    'SELECT COUNT(*) as count FROM questions WHERE assessment_id = $1',
    [assessment.id as number]
  );
  const totalQuestions = parseInt(totalQuestionsRes.rows[0].count, 10) || 0;

  const totalMarksRes = await query(
    'SELECT COALESCE(SUM(max_marks), 0) as total FROM questions WHERE assessment_id = $1',
    [assessment.id as number]
  );
  const totalMarks = parseInt(totalMarksRes.rows[0].total, 10) || 0;

  const leaderboardRes = await query(`
    SELECT
      s.name,
      s.usn,
      COUNT(CASE WHEN r.answer_text != '' THEN 1 END) as answered,
      COALESCE(SUM(CASE WHEN r.reviewed = 1 THEN r.marks_awarded ELSE 0 END), 0) as score
    FROM students s
    INNER JOIN responses r ON r.student_id = s.id
    INNER JOIN questions q ON r.question_id = q.id AND q.assessment_id = $1
    WHERE r.answer_text != ''
    GROUP BY s.id
    ORDER BY score DESC, answered DESC, MIN(r.submitted_at) ASC
  `, [assessment.id as number]);
  const leaderboard = leaderboardRes.rows as { name: string; usn: string; answered: string; score: string }[];

  const result = leaderboard.map(s => ({
    ...s,
    answered: parseInt(s.answered, 10),
    score: parseInt(s.score, 10),
    total_questions: totalQuestions,
    total_marks: totalMarks,
  }));

  return NextResponse.json({
    leaderboard: result,
    currentUser: session.name,
    assessmentActive: true,
  });
}
