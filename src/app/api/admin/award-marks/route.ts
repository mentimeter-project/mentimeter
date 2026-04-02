import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { responseId, marks } = await req.json();
  db.prepare('UPDATE responses SET marks_awarded = ?, reviewed = 1 WHERE id = ?').run(marks, responseId);

  return NextResponse.json({ success: true });
}
