import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
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
    // Empty body is okay for this non-critical event endpoint
  }
  const { event, count } = body;

  try {
    db.prepare(
      'INSERT INTO student_events (student_id, event_type, event_count) VALUES (?, ?, ?)'
    ).run(session.userId, event || 'unknown', count || 1);
  } catch {
    // Non-critical, don't fail the request
  }

  return NextResponse.json({ success: true });
}
