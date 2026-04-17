import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { query } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: { submissionId: string } }
) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const result = await query(
    'SELECT * FROM code_submissions WHERE id = $1 AND student_id = $2',
    [params.submissionId, session.userId]
  );

  if (!result.rows.length) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  return NextResponse.json(result.rows[0]);
}
