import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import db from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function POST(req: NextRequest) {
  const { username, password, role } = await req.json();

  let user: Record<string, unknown> | undefined;

  if (role === 'admin') {
    user = db.prepare('SELECT * FROM admins WHERE username = ? AND password = ?').get(username, password) as Record<string, unknown> | undefined;
  } else {
    user = db.prepare('SELECT * FROM students WHERE username = ? AND password = ?').get(username, password) as Record<string, unknown> | undefined;
  }

  if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  session.userId = user.id as number;
  session.username = user.username as string;
  session.name = role === 'student' ? user.name as string : 'Admin';
  session.role = role;
  await session.save();

  return NextResponse.json({ success: true, role });
}
