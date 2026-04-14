import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import db from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);

  if (session.role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Non-critical
  }
  const { assessmentId, type } = body;

  db.prepare(
    'INSERT INTO violations (student_id, assessment_id, type) VALUES (?, ?, ?)'
  ).run(session.userId, assessmentId, type);

  return NextResponse.json({ success: true });
}