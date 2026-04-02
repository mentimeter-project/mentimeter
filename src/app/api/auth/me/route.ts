import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (!session.userId) return NextResponse.json({ loggedIn: false });
  return NextResponse.json({ loggedIn: true, role: session.role, username: session.username, name: session.name });
}
