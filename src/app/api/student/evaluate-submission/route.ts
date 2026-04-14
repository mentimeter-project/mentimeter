/**
 * @file src/app/api/student/evaluate-submission/route.ts
 *
 * Enqueues a student's code submission for asynchronous evaluation.
 */

import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';
import { checkRateLimit } from '@/lib/piston';
import { enqueueSubmissionLog } from '@/lib/submission-log';
import { evaluationQueue } from '@/queue';

export async function POST(req: NextRequest) {
  // 0. Auth guard
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'student' || !session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Rate Limiting (15 max per minute) via robust Async Redis Hook
  const rateLimitOk = await checkRateLimit(session.userId);
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: 'Too many submissions. Please wait a minute before trying again.' },
      { status: 429 }
    );
  }

  // 1. Parse request body
  let body: { questionId: number; languageId: number; sourceCode: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { questionId, languageId, sourceCode } = body;
  if (!questionId || !languageId || !sourceCode?.trim()) {
    return NextResponse.json(
      { error: 'questionId, languageId, and sourceCode are required' },
      { status: 400 }
    );
  }

  if (sourceCode.length > 50000) {
    return NextResponse.json(
      { error: 'Code submission exceeds maximum allowed length of 50,000 characters.' },
      { status: 413 }
    );
  }

  // 2. Validate the question
  const question = db
    .prepare(
      `SELECT q.id, q.assessment_id, q.question_type, q.code_mode, q.function_name
       FROM questions q
       JOIN assessments a ON q.assessment_id = a.id
       WHERE q.id = ? AND a.is_active = 1`
    )
    .get(questionId) as any;

  if (!question) {
    return NextResponse.json(
      { error: 'Question not found or assessment is inactive' },
      { status: 404 }
    );
  }
  if (question.question_type !== 'code') {
    return NextResponse.json(
      { error: 'This question does not support code submission' },
      { status: 400 }
    );
  }

  // ── Guard: function-mode questions must have a valid, non-empty function_name ──
  if (question.code_mode === 'function') {
    const VALID_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
    const fn: string | null = question.function_name ?? null;
    if (!fn || !fn.trim() || !VALID_IDENTIFIER.test(fn.trim())) {
      console.error(
        `[evaluate-submission] Question ${questionId} has missing or malformed function_name: "${fn}". ` +
        `Rejecting submission to prevent worker crash.`
      );
      return NextResponse.json(
        {
          error:
            'This question has an invalid configuration (missing or malformed function name). ' +
            'Please contact your administrator.',
        },
        { status: 422 }
      );
    }
  }
  // ────────────────────────────────────────────────────────────────────────────

  // 3. One-shot lock — no re-submissions
  const prev = db
    .prepare('SELECT id FROM code_submissions WHERE student_id = ? AND question_id = ?')
    .get(session.userId, questionId);
  if (prev) {
    return NextResponse.json(
      { error: 'Already submitted', alreadySubmitted: true },
      { status: 400 }
    );
  }

  // 4. Fetch test cases count
  const result = db.prepare('SELECT COUNT(*) as c FROM test_cases WHERE question_id = ?').get(questionId) as { c: number };
  if (result.c === 0) {
    return NextResponse.json(
      { error: 'No test cases configured for this question' },
      { status: 400 }
    );
  }

  // 5. Inject DB placeholder mapping pipeline
  const logId = enqueueSubmissionLog(session.userId, questionId, languageId, result.c);

  // 5.5 Validate queue depth bounds mitigating backpressure abuse loops natively
  const queueSize = await evaluationQueue.count();
  if (queueSize > 100) {
    return NextResponse.json(
      { error: 'System is currently under heavy load and queue is saturated. Please try again in exactly 2 minutes.' },
      { status: 503 }
    );
  }

  // 6. Push payload payload onto the Queue layer locally
  await evaluationQueue.add('evaluate', {
    logId,
    studentId: session.userId,
    questionId,
    languageId,
    sourceCode,
  });

  // 7. Reject wait bounds resolving cleanly allowing UI loader display
  return NextResponse.json({
    success: true,
    logId,
    status: 'queued',
    message: 'Submission enqueued successfully.',
  });
}
