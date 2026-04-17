import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { query } from '@/lib/db';
import { codeQueue } from '@/lib/queue';

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { source_code, language_id, expected_output, question_id, max_marks } = await req.json();

  if (!source_code || !language_id || !question_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Insert into code_submissions
  const result = await query(
    `INSERT INTO code_submissions (student_id, question_id, source_code, language_id, status)
     VALUES ($1, $2, $3, $4, 'queued') RETURNING id`,
    [session.userId, question_id, source_code, language_id]
  );

  const submissionId = result.rows[0].id;

  // Add to BullMQ queue
  await codeQueue.add('execute', {
    submissionId,
    source_code,
    language_id,
    expected_output: expected_output || '',
    question_id,
    student_id: session.userId,
    max_marks: max_marks || 10,
  });

  return NextResponse.json({ submissionId, status: 'queued' });
}
