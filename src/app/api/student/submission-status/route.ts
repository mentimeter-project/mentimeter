/**
 * @file src/app/api/student/submission-status/route.ts
 *
 * Polls the DB tracking real-time status of queued BullMQ jobs.
 */

import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'student' || !session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const logId = searchParams.get('logId');

  if (!logId) {
    return NextResponse.json({ error: 'Missing logId' }, { status: 400 });
  }

  const log = db
    .prepare(
      `SELECT status, error_message, result_payload 
       FROM submission_logs 
       WHERE id = ? AND student_id = ?`
    )
    .get(logId, session.userId) as any;

  if (!log) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  // Still parsing constraints offline
  if (log.status === 'queued' || log.status === 'running') {
    return NextResponse.json({ status: log.status });
  }

  // System/Worker error trapped
  if (log.status === 'error') {
    return NextResponse.json({
      status: 'error',
      error: log.error_message || 'An unknown execution error occurred.',
    });
  }

  // Completion resolving exactly as previous synchronous model evaluated.
  if (log.status === 'completed') {
    try {
      const payload = JSON.parse(log.result_payload);
      return NextResponse.json({
        status: 'completed',
        data: payload,
      });
    } catch (e) {
      return NextResponse.json({
        status: 'error',
        error: 'Evaluation succeeded but parsing results failed critically.',
      });
    }
  }

  return NextResponse.json({ status: 'unknown' });
}
