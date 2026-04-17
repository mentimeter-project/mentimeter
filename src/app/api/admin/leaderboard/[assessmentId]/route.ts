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

  const totalMarksRes = await query(
    'SELECT COALESCE(SUM(max_marks), 0) as total FROM questions WHERE assessment_id = $1',
    [aId]
  );
  const totalMarks = parseInt(totalMarksRes.rows[0].total, 10) || 0;

  const leaderboardRes = await query(`
    SELECT
      s.name,
      s.usn,
      COUNT(CASE WHEN r.answer_text != '' THEN 1 END) as answered,
      COALESCE(SUM(CASE WHEN r.reviewed = 1 THEN r.marks_awarded ELSE 0 END), 0) as score
    FROM students s
    LEFT JOIN responses r ON r.student_id = s.id
    LEFT JOIN questions q ON r.question_id = q.id AND q.assessment_id = $1
    GROUP BY s.id
    ORDER BY score DESC, answered DESC
  `, [aId]);
  const leaderboard = leaderboardRes.rows as { name: string; usn: string; answered: string; score: string }[];

  const result = leaderboard.map(s => ({
    ...s,
    answered: parseInt(s.answered, 10),
    score: parseInt(s.score, 10),
    total_questions: totalQuestions,
    total_marks: totalMarks,
  }));

  return NextResponse.json({ leaderboard: result });
}
