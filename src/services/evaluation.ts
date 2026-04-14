/**
 * @file src/services/evaluation.ts
 *
 * Core execution evaluator. Ripped out of the route.ts to function synchronously 
 * inside background workers independent of Next/HTTP boundaries.
 */

import db from '@/lib/db';
import {
  executePistonTimed,
  normalisePistonResponse,
  resolveFromJudge0Id,
  type NormalisedResult,
} from '@/lib/piston';
import {
  completeSubmissionLog,
  failSubmissionLog,
} from '@/lib/submission-log';
import { assembleCode } from '@/lib/code-assembler';
import { generateTemplates } from '@/lib/driver-templates';
import type { EvaluationJobData } from '@/queue';

// ── Types ────────────────────────────────────────────────────────────────────

interface TestCase {
  id: number;
  input: string;
  expected_output: string;
  marks: number;
}

interface TimedTestResult {
  result: NormalisedResult;
  wallClockMs: number;
}

// ── Status label ─────────────────────────────────────────────────────────────

function statusLabel(id: number): string {
  if (id === 3)  return 'Accepted';
  if (id === 4)  return 'Wrong Answer';
  if (id === 5)  return 'Time Limit Exceeded';
  if (id === 6)  return 'Compilation Error';
  if (id >= 7 && id <= 12) return 'Runtime Error';
  if (id === 13) return 'Internal Error';
  return 'Unknown Error';
}

// ── Execute one test case via Piston ─────────────────────────────────────────

async function runTestCase(
  sourceCode: string,
  pistonLanguage: string,
  pistonVersion: string,
  tc: TestCase
): Promise<TimedTestResult> {
  const { response, wallClockMs } = await executePistonTimed({
    sourceCode,
    language: pistonLanguage,
    version: pistonVersion,
    stdin: tc.input,
  });

  const result = normalisePistonResponse(response, tc.expected_output, wallClockMs);
  return { result, wallClockMs };
}

// ── Primary Evaluator ────────────────────────────────────────────────────────

export async function processSubmission(jobData: EvaluationJobData) {
  const { logId, studentId, questionId, languageId, sourceCode } = jobData;

  // 1. Validate Question context rigorously
  const question = db
    .prepare(
      `SELECT q.id, q.max_marks, q.assessment_id, q.question_type, q.code_mode, q.function_name
       FROM questions q
       JOIN assessments a ON q.assessment_id = a.id
       WHERE q.id = ? AND a.is_active = 1`
    )
    .get(questionId) as any;

  if (!question) {
    failSubmissionLog(logId, 'Question not found or assessment is inactive.');
    return;
  }

  // 2. Fetch test cases 
  const testCases = db
    .prepare('SELECT id, input, expected_output, marks FROM test_cases WHERE question_id = ? ORDER BY id ASC')
    .all(questionId) as TestCase[];

  if (testCases.length === 0) {
    failSubmissionLog(logId, 'No test cases configured for this question.');
    return;
  }

  // 3. Resolve Judge0 Language references
  let pistonLanguage: string;
  let pistonVersion: string;
  try {
    const resolved = await resolveFromJudge0Id(languageId);
    pistonLanguage = resolved.language;
    pistonVersion = resolved.version;
  } catch (err: any) {
    const msg = err.message || String(err);
    failSubmissionLog(logId, `Unsupported language (id=${languageId}): ${msg}`);
    return;
  }

  // 4. Assemble Code
  let finalSourceCode: string;

  if (question.code_mode === 'function') {
    // ── Pre-execution guard: function_name MUST be a non-empty valid identifier ──
    const functionName: string | null = question.function_name ?? null;

    if (!functionName || !functionName.trim()) {
      // This should never happen because create-assessment now validates it.
      // But we guard here too so a DB inconsistency can never reach Piston.
      const msg =
        `[Config Error] Question ${questionId} is set to function mode but has no function_name stored in the database. ` +
        `Please contact the administrator to fix this question configuration.`;
      console.error(`[evaluator] ${msg}`);
      failSubmissionLog(logId, msg);
      return;
    }

    // Sanity check: must be a plain identifier (no spaces, parens, colons)
    const VALID_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
    if (!VALID_IDENTIFIER.test(functionName)) {
      const msg =
        `[Config Error] Question ${questionId} has a malformed function_name: "${functionName}". ` +
        `Must be a plain identifier. Please ask the administrator to fix the question configuration.`;
      console.error(`[evaluator] ${msg}`);
      failSubmissionLog(logId, msg);
      return;
    }

    const template = db
      .prepare('SELECT driver_code FROM question_templates WHERE question_id = ? AND language_id = ?')
      .get(questionId, languageId) as { driver_code: string } | undefined;

    let driverCode: string;
    if (template?.driver_code) {
      driverCode = template.driver_code;
    } else {
      const generated = generateTemplates(functionName, languageId);
      if (!generated) {
        failSubmissionLog(logId, 'Function mode is not supported for this language.');
        return;
      }
      driverCode = generated.driverCode;
    }

    let expectedParamCount = -1;
    try {
      const parsedInput = JSON.parse(testCases[0].input);
      if (Array.isArray(parsedInput)) {
        expectedParamCount = parsedInput.length;
      }
    } catch { /* soft fallback */ }

    const assembly = await assembleCode({
      studentCode: sourceCode,
      driverCode,
      functionName,
      language: pistonLanguage,
      expectedParamCount,
    });

    if (!assembly.ok) {
      failSubmissionLog(logId, assembly.error || 'Failed to assemble code.');
      return;
    }

    finalSourceCode = assembly.code!;
  } else {
    finalSourceCode = sourceCode;
  }

  // 5. Execute Code Pipeline Sequential Limits
  const MAX_TOTAL_EXECUTION_MS = 15000;
  let timedResults: TimedTestResult[] = [];
  let totalWallClockMs = 0;

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

      const res = await runTestCase(finalSourceCode, pistonLanguage, pistonVersion, tc);
      timedResults.push(res);
      totalWallClockMs += res.wallClockMs;
    }
  } catch (err: any) {
    const msg = err.message || 'Unknown error';
    console.error('[evaluator-worker] Piston error:', msg);
    failSubmissionLog(logId, msg);
    return;
  }

  // 6. Processing Score Metrics
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

  // 7. Store results
  const saveSubmission = db.transaction(() => {
    db.prepare(
      `INSERT INTO code_submissions
         (student_id, question_id, language_id, source_code, score, test_cases_passed, total_test_cases, compilation_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      studentId,
      questionId,
      languageId,
      sourceCode,
      score,
      passed,
      testCases.length,
      compilationError
    );

    db.prepare(
      `INSERT OR REPLACE INTO responses
         (student_id, question_id, answer_text, marks_awarded, reviewed)
       VALUES (?, ?, ?, ?, 1)`
    ).run(studentId, questionId, sourceCode, score);
  });

  try {
    saveSubmission();
  } catch (err) {
    failSubmissionLog(logId, 'Failed to save submission dynamically to SQLite.');
    return;
  }

  // 8. Package TC1 standard feedback payload for the Log status polling response
  const tc1Result = results[0];
  const tc1Case = testCases[0];
  
  const payloadResponse = JSON.stringify({
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
  });

  // Finalize
  completeSubmissionLog(logId, passed, totalWallClockMs, payloadResponse);
}
