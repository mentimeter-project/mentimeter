/**
 * @file src/app/api/student/evaluate-submission/route.ts
 *
 * Evaluates a student's code submission synchronously via Piston API.
 * No queue, no polling — Piston is called directly and the result is
 * returned in a single HTTP response.
 */

import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import pool from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';
import {
  executePistonTimed,
  normalisePistonResponse,
  resolveFromJudge0Id,
  type NormalisedResult,
} from '@/lib/piston';
import { assembleCode } from '@/lib/code-assembler';
import { generateTemplates } from '@/lib/driver-templates';

// ── Types ────────────────────────────────────────────────────────────────────

interface TestCase {
  id: number;
  input: string;
  expected_output: string;
  marks: number;
}

function statusLabel(id: number): string {
  if (id === 3) return 'Accepted';
  if (id === 4) return 'Wrong Answer';
  if (id === 5) return 'Time Limit Exceeded';
  if (id === 6) return 'Compilation Error';
  if (id >= 7 && id <= 12) return 'Runtime Error';
  if (id === 13) return 'Internal Error';
  return 'Unknown Error';
}

export async function POST(req: NextRequest) {
  // 0. Auth guard
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (session.role !== 'student' || !session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
  const questionRes = await query(
    `SELECT q.id, q.assessment_id, q.question_type, q.code_mode, q.function_name, q.max_marks
     FROM questions q
     JOIN assessments a ON q.assessment_id = a.id
     WHERE q.id = $1 AND a.is_active = 1`,
    [questionId]
  );
  const question = questionRes.rows[0] as any;

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
        `Rejecting submission to prevent crash.`
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

  // 3. One-shot lock — no re-submissions
  const prevRes = await query('SELECT id FROM code_submissions WHERE student_id = $1 AND question_id = $2', [session.userId, questionId]);
  const prev = prevRes.rows[0];
  if (prev) {
    return NextResponse.json(
      { error: 'Already submitted', alreadySubmitted: true },
      { status: 400 }
    );
  }

  // 4. Fetch test cases
  const testCasesRes = await query('SELECT id, input, expected_output, marks FROM test_cases WHERE question_id = $1 ORDER BY id ASC', [questionId]);
  const testCases = testCasesRes.rows as TestCase[];

  if (testCases.length === 0) {
    return NextResponse.json(
      { error: 'No test cases configured for this question' },
      { status: 400 }
    );
  }

  // 5. Resolve Piston language
  let pistonLanguage: string;
  let pistonVersion: string;
  try {
    const resolved = await resolveFromJudge0Id(languageId);
    pistonLanguage = resolved.language;
    pistonVersion = resolved.version;
  } catch (err: any) {
    const msg = err.message || String(err);
    return NextResponse.json(
      { error: `Unsupported language (id=${languageId}): ${msg}` },
      { status: 422 }
    );
  }

  // 6. Assemble Code (handle function-mode vs full-program mode)
  let finalSourceCode: string;

  if (question.code_mode === 'function') {
    const functionName: string = question.function_name!;

    const templateRes = await query('SELECT driver_code FROM question_templates WHERE question_id = $1 AND language_id = $2', [questionId, languageId]);
    const template = templateRes.rows[0] as { driver_code: string } | undefined;

    let driverCode: string;
    if (template?.driver_code) {
      driverCode = template.driver_code;
    } else {
      const generated = generateTemplates(functionName, languageId);
      if (!generated) {
        return NextResponse.json(
          { error: 'Function mode is not supported for this language.' },
          { status: 422 }
        );
      }
      driverCode = generated.driverCode;
    }

    let expectedParamCount = -1;
    try {
      const inputStr = testCases[0].input?.trim();
      if (inputStr) {
        let parsedInput;
        try {
          parsedInput = JSON.parse(inputStr);
        } catch {
          parsedInput = null;
        }
        if (Array.isArray(parsedInput)) {
          expectedParamCount = parsedInput.length;
        }
      }
    } catch {
      // ignore
    }

    const assembly = await assembleCode({
      studentCode: sourceCode,
      driverCode,
      functionName,
      language: pistonLanguage,
      expectedParamCount,
    });

    if (!assembly.ok) {
      return NextResponse.json(
        { error: assembly.error || 'Failed to assemble code.' },
        { status: 422 }
      );
    }

    finalSourceCode = assembly.code!;
  } else {
    finalSourceCode = sourceCode;
  }

  // 7. Execute all test cases via Piston SYNCHRONOUSLY
  const MAX_TOTAL_EXECUTION_MS = 15000;
  let totalWallClockMs = 0;

  interface TimedTestResult {
    result: NormalisedResult;
    wallClockMs: number;
  }

  const timedResults: TimedTestResult[] = [];

  try {
    for (const tc of testCases) {
      if (totalWallClockMs >= MAX_TOTAL_EXECUTION_MS) {
        timedResults.push({
          result: {
            status: { id: 5, description: 'Time Limit Exceeded' },
            stdout: null,
            stderr: 'Submission exceeded maximum total execution time cap.',
            compile_output: null,
            time: '0.000',
            memory: 0
          },
          wallClockMs: 0
        });
        continue;
      }

      const { response, wallClockMs } = await executePistonTimed({
        sourceCode: finalSourceCode,
        language: pistonLanguage,
        version: pistonVersion,
        stdin: tc.input,
      });

      const result = normalisePistonResponse(response, tc.expected_output, wallClockMs);
      timedResults.push({ result, wallClockMs });
      totalWallClockMs += wallClockMs;
    }
  } catch (err: any) {
    const msg = err.message || 'Unknown execution error';
    console.error('[evaluate-submission] Piston error:', msg);
    return NextResponse.json(
      { error: `Execution failed: ${msg}` },
      { status: 502 }
    );
  }

  // 8. Score calculation
  const results = timedResults.map(r => r.result);
  let compilationError: string | null = null;
  let passed = 0;
  let totalMarks = 0;

  const testResults = results.map((r, i) => {
    const tc = testCases[i];
    if (r.status.id === 6) {
      compilationError = compilationError ?? (r.compile_output?.trim() ?? r.stderr?.trim() ?? 'Compilation error');
    }

    const isPass = r.status.id === 3;
    if (isPass) {
      passed++;
      totalMarks += tc.marks;
    }

    const execTime = parseFloat(r.time || '0') * 1000;

    return {
      testCaseIndex: i + 1,
      passed: isPass,
      status: statusLabel(r.status.id),
      stdout: r.stdout ? r.stdout.trim() : null,
      stderr: r.stderr ? r.stderr.trim() : null,
      execution_time_ms: execTime > 0 ? Math.round(execTime) : timedResults[i].wallClockMs,
      errorOutput: !isPass && r.stderr ? r.stderr.trim() : null,
    };
  });

  const totalPossibleMarks = testCases.reduce((sum, tc) => sum + tc.marks, 0);
  const score = totalPossibleMarks > 0 ? Math.round((totalMarks / totalPossibleMarks) * question.max_marks) : 0;

  // 9. Store results in DB
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO code_submissions
           (student_id, question_id, language_id, source_code, score, test_cases_passed, total_test_cases, compilation_error)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [session.userId, questionId, languageId, sourceCode, score, passed, testCases.length, compilationError]
      );
      await client.query(
        `INSERT INTO responses
           (student_id, question_id, answer_text, marks_awarded, reviewed)
         VALUES ($1, $2, $3, $4, 1) ON CONFLICT (student_id, question_id) DO UPDATE SET answer_text = $3, marks_awarded = $4, reviewed = 1`,
        [session.userId, questionId, sourceCode, score]
      );
      await client.query('COMMIT');
    } catch(err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[evaluate-submission] DB save error:', err);
    return NextResponse.json(
      { error: 'Failed to save submission results.' },
      { status: 500 }
    );
  }

  // 10. Build and return the full result payload — single response, no polling needed
  const tc1Result = results[0];
  const tc1Case = testCases[0];

  const payload = {
    success: true,
    score,
    maxMarks: question.max_marks,
    passed,
    total: testCases.length,
    compilationError,
    firstTestCaseDetails: {
      status: tc1Result.status.id === 3 ? 'Pass' : 'Fail',
      executionStatus: statusLabel(tc1Result.status.id),
      stdout: (tc1Result.stdout ?? '').trim() || null,
      expectedOutput: tc1Result.status.id === 3 ? null : tc1Case.expected_output.trim(),
      compileOutput: tc1Result.compile_output?.trim() || null,
      stderr: tc1Result.stderr?.trim() || null,
      time: tc1Result.time,
      memory: tc1Result.memory,
    },
    testResults,
    executionTimeMs: totalWallClockMs,
  };

  return NextResponse.json(payload);
}
