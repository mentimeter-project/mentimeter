import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { assessmentId, isActive } = await req.json();

  if (isActive) await query('UPDATE assessments SET is_active = 0');
  await query('UPDATE assessments SET is_active = $1 WHERE id = $2', [isActive ? 1 : 0, assessmentId]);

  return NextResponse.json({ success: true });
}
