import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);

  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const data = db.prepare(`
    SELECT v.*, s.name, s.usn
    FROM violations v
    JOIN students s ON v.student_id = s.id
    ORDER BY v.created_at DESC
  `).all();

  return NextResponse.json({ violations: data });
}