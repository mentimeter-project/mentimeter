/**
 * @file src/app/api/student/submission-status/route.ts
 *
 * Polls the DB tracking real-time status of queued BullMQ jobs.
 */

import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
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

  const logRes = await query(
    `SELECT status, error_message, result_payload 
     FROM submission_logs 
     WHERE id = $1 AND student_id = $2`,
    [logId, session.userId]
  );
  const log = logRes.rows[0] as any;

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
    if (!log.result_payload || log.result_payload.trim() === "") {
      return NextResponse.json({
        status: 'error',
        error: 'Evaluation completed but returned an empty result payload.',
      });
    }

    try {
      const payload = JSON.parse(log.result_payload);
      if (!payload || typeof payload !== "object") {
        throw new Error("Invalid payload structure");
      }
      return NextResponse.json({
        status: 'completed',
        data: payload,
      });
    } catch (e) {
      console.error("[status-api] Failed to parse result_payload:", log.result_payload);
      return NextResponse.json({
        status: 'error',
        error: 'Evaluation succeeded but the results were malformed.',
      });
    }
  }

  return NextResponse.json({ status: 'unknown' });
}
