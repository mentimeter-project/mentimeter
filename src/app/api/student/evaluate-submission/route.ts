import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/session';

// ── Types ──────────────────────────────────────────────────────────────────
interface TestCase {
  id: number;
  input: string;
  expected_output: string;
  marks: number;
}

interface Judge0Submission {
  token: string;
}

interface Judge0Result {
  status: { id: number; description: string };
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  time: string | null;
  memory: number | null;
}

// ── Judge0 helpers ─────────────────────────────────────────────────────────
const JUDGE0_URL = (process.env.JUDGE0_API_URL ?? 'http://localhost:2358').replace(/\/$/, '');
const JUDGE0_KEY = process.env.JUDGE0_API_KEY ?? '';

function judge0Headers(): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  if (JUDGE0_KEY) {
    h['X-RapidAPI-Key'] = JUDGE0_KEY;
    h['X-RapidAPI-Host'] = new URL(JUDGE0_URL).hostname;
  }
  return h;
}

/** Submit a batch of test cases and return their tokens */
async function submitBatch(
  sourceCode: string,
  languageId: number,
  testCases: TestCase[]
): Promise<string[]> {
  const submissions = testCases.map((tc) => ({
    source_code: sourceCode,
    language_id: languageId,
    stdin: tc.input,
    cpu_time_limit: 5,
    memory_limit: 256000,
  }));

  let res: Response;
  try {
    res = await fetch(`${JUDGE0_URL}/submissions/batch?base64_encoded=false`, {
      method: 'POST',
      headers: judge0Headers(),
      body: JSON.stringify({ submissions }),
      // @ts-ignore — AbortSignal.timeout is available in Node 17+ / Next 14
      signal: AbortSignal.timeout(15000),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Connection refused = Docker/Judge0 not running
    if (
      msg.includes('ECONNREFUSED') ||
      msg.includes('fetch failed') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('TimeoutError') ||
      msg.includes('The operation was aborted')
    ) {
      throw new Error(
        `Cannot reach Judge0 at "${JUDGE0_URL}". ` +
        (JUDGE0_KEY
          ? `Check that your JUDGE0_API_URL is correct.`
          : `Start Docker (open Docker Desktop) or set JUDGE0_API_URL + JUDGE0_API_KEY in .env.local for RapidAPI.`)
      );
    }
    throw new Error(`Judge0 network error: ${msg}`);
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error('Judge0 API key rejected (401/403). Check JUDGE0_API_KEY in .env.local and restart the dev server.');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Judge0 batch submit failed (HTTP ${res.status}): ${text}`);
  }

  const data = (await res.json()) as Judge0Submission[];
  return data.map((s) => s.token);
}

/** Poll until all tokens are finished — status id > 2 means done */
async function pollResults(tokens: string[]): Promise<Judge0Result[]> {
  const tokenStr = tokens.join(',');
  const maxAttempts = 20;
  const delayMs = 1500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, delayMs));

    const res = await fetch(
      `${JUDGE0_URL}/submissions/batch?tokens=${tokenStr}&base64_encoded=false&fields=token,status,stdout,stderr,compile_output,time,memory`,
      { headers: judge0Headers() }
    );

    if (!res.ok) throw new Error(`Judge0 poll failed (${res.status})`);

    const data = (await res.json()) as { submissions: Judge0Result[] };
    const results = data.submissions;

    // status id 1 = In Queue, 2 = Processing — wait for all to complete
    const allDone = results.every((r) => r.status.id > 2);
    if (allDone) return results;
  }

  throw new Error('Judge0 evaluation timed out after 30 seconds');
}

// ── Route handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: 'questionId, languageId, and sourceCode are required' }, { status: 400 });
  }

  // 2. Validate the question exists, is a coding question, and its assessment is active
  const question = db.prepare(
    `SELECT q.id, q.max_marks, q.assessment_id, q.question_type
     FROM questions q
     JOIN assessments a ON q.assessment_id = a.id
     WHERE q.id = ? AND a.is_active = 1`
  ).get(questionId) as { id: number; max_marks: number; assessment_id: number; question_type: string } | undefined;

  if (!question) {
    return NextResponse.json({ error: 'Question not found or assessment is inactive' }, { status: 404 });
  }
  if (question.question_type !== 'code') {
    return NextResponse.json({ error: 'This question does not support code submission' }, { status: 400 });
  }

  // 3. Check if already submitted (lock it)
  const prev = db.prepare(
    'SELECT id FROM code_submissions WHERE student_id = ? AND question_id = ?'
  ).get(session.userId, questionId);
  if (prev) {
    return NextResponse.json({ error: 'Already submitted', alreadySubmitted: true }, { status: 400 });
  }

  // 4. Fetch hidden test cases (NEVER sent to client)
  const testCases = db.prepare(
    'SELECT id, input, expected_output, marks FROM test_cases WHERE question_id = ? ORDER BY id ASC'
  ).all(questionId) as TestCase[];

  if (testCases.length === 0) {
    return NextResponse.json({ error: 'No test cases configured for this question' }, { status: 400 });
  }

  // 5. Submit to Judge0
  let tokens: string[];
  try {
    tokens = await submitBatch(sourceCode, languageId, testCases);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[evaluate-submission] Judge0 submit error:', msg);
    return NextResponse.json(
      { error: msg },
      { status: 502 }
    );
  }

  // 6. Poll for results
  let results: Judge0Result[];
  try {
    results = await pollResults(tokens);
  } catch (err) {
    console.error('[evaluate-submission] Judge0 poll error:', err);
    return NextResponse.json(
      { error: 'Evaluation timed out. Your code may have an infinite loop.' },
      { status: 504 }
    );
  }

  // 7. Score: compare stdout to expected_output (trimmed)
  let compilationError: string | null = null;
  let passed = 0;
  let totalMarks = 0;

  const testResults = results.map((r, i) => {
    const tc = testCases[i];
    // Status 6 = Compilation Error
    if (r.status.id === 6) {
      compilationError = r.compile_output?.trim() ?? 'Compilation error';
    }
    const actual = (r.stdout ?? '').trim();
    const expected = tc.expected_output.trim();
    const isPass = r.status.id === 3 && actual === expected; // 3 = Accepted
    if (isPass) {
      passed++;
      totalMarks += tc.marks;
    }
    return { 
      testCaseIndex: i + 1, 
      passed: isPass, 
      status: r.status.description,
      errorOutput: !isPass && r.stderr ? r.stderr.trim() : null
    };
  });

  // Partial scoring: scale to max_marks based on full total possible marks
  const totalPossibleMarks = testCases.reduce((sum, tc) => sum + tc.marks, 0);
  const score = totalPossibleMarks > 0
    ? Math.round((totalMarks / totalPossibleMarks) * question.max_marks)
    : 0;

  // 8. Save to code_submissions and responses (inside a transaction)
  const saveSubmission = db.transaction(() => {
    db.prepare(
      `INSERT INTO code_submissions
        (student_id, question_id, language_id, source_code, score, test_cases_passed, total_test_cases, compilation_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      session.userId,
      questionId,
      languageId,
      sourceCode,
      score,
      passed,
      testCases.length,
      compilationError
    );

    // Insert into responses so the existing leaderboard / review system picks it up
    db.prepare(
      `INSERT OR REPLACE INTO responses
        (student_id, question_id, answer_text, marks_awarded, reviewed)
       VALUES (?, ?, ?, ?, 1)`
    ).run(
      session.userId,
      questionId,
      sourceCode,  // store the code as the answer text for admin review
      score
    );
  });

  try {
    saveSubmission();
  } catch (err) {
    console.error('[evaluate-submission] DB save error:', err);
    return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 });
  }

  // 9. Build first_test_case_details (TC1 feedback only — no input/expected exposed beyond TC1)
  const tc1Result = results[0];
  const tc1Case = testCases[0];
  const tc1Actual = (tc1Result.stdout ?? '').trim();
  const tc1Expected = tc1Case.expected_output.trim();
  const tc1Pass = tc1Result.status.id === 3 && tc1Actual === tc1Expected;

  const firstTestCaseDetails = {
    status: tc1Pass ? 'Pass' : 'Fail',
    stdout: tc1Actual || null,
    expectedOutput: tc1Pass ? null : tc1Expected, // only reveal expected when wrong
    compileOutput: tc1Result.compile_output?.trim() || null,
    stderr: tc1Result.stderr?.trim() || null,
    executionStatus: tc1Result.status.description,
    time: tc1Result.time,
    memory: tc1Result.memory,
  };

  // 10. Return result — test case inputs/outputs for TC2+ never leave the server
  return NextResponse.json({
    success: true,
    score,
    maxMarks: question.max_marks,
    passed,
    total: testCases.length,
    compilationError,
    firstTestCaseDetails,
    testResults: testResults.map(({ testCaseIndex, passed: p, status, errorOutput }) => ({
      testCaseIndex,
      passed: p,
      status,
      errorOutput,
    })),
  });
}
