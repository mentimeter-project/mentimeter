import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function DELETE(req: NextRequest) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { assessmentId } = await req.json();
  if (!assessmentId) {
    return NextResponse.json({ error: 'Assessment ID required' }, { status: 400 });
  }

  const assessmentRes = await query('SELECT is_active FROM assessments WHERE id = $1', [assessmentId]);
  const assessment = assessmentRes.rows[0] as { is_active: number } | undefined;
  if (!assessment) {
    return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
  }

  if (assessment.is_active) {
    return NextResponse.json({ error: 'Cannot delete a live assessment. Stop it first.' }, { status: 400 });
  }

  await query('DELETE FROM assessments WHERE id = $1', [assessmentId]);

  return NextResponse.json({ success: true });
}
