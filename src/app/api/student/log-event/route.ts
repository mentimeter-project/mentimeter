import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import db from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.userId || session.role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { event } = await req.json();

  // Find the active assessment
  const assessment = db.prepare('SELECT id FROM assessments WHERE is_active = 1 LIMIT 1').get() as { id: number } | undefined;
  if (!assessment) {
    return NextResponse.json({ error: 'No active assessment' }, { status: 400 });
  }

  db.prepare(
    'INSERT INTO violations (student_id, assessment_id, type) VALUES (?, ?, ?)'
  ).run(session.userId, assessment.id, event || 'tab_switch');

  return NextResponse.json({ ok: true });
}
