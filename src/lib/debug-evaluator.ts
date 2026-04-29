/**
 * debug-evaluator.ts
 *
 * Modular evaluation engine for "Debug" question type.
 * Designed to be extended with partial-marking, token-based,
 * and line-by-line scoring strategies in the future.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type DebugEvalStatus = 'accepted' | 'wrong_answer';

export interface DebugEvalOptions {
  /** If false, comparison is case-insensitive. Default: true */
  caseSensitive?: boolean;
  /** If true, ignore punctuation (.,!?). Default: false */
  ignorePunctuation?: boolean;
}

export interface DebugEvalResult {
  status: DebugEvalStatus;
  /** Marks awarded (either maxMarks or 0 in the current strategy) */
  marks: number;
  maxMarks: number;
  /** Short human-readable explanation */
  message: string;
  /** Structured data kept for future partial-marking strategies */
  meta: {
    studentAnswer: string;
    expectedOutput: string;
    normalised: {
      student: string;
      expected: string;
    };
  };
}

// ── Normalisation helpers ─────────────────────────────────────────────────────

/**
 * Normalises text by applying the following rules:
 * 1. Normalize line endings (\r\n → \n)
 * 2. Convert multiple spaces → single space
 * 3. Remove trailing spaces per line
 * 4. Trim leading and trailing whitespace
 * 5. Ignore extra blank lines at start/end
 * 6. (Optional) Ignore punctuation and case
 */
export function normalizeOutput(text: string, opts: Required<DebugEvalOptions>): string {
  // 1. Normalize line endings (\r\n → \n)
  let normalized = text.replace(/\r\n/g, '\n');
  
  // 2. Convert multiple spaces → single space & 3. Remove trailing spaces per line
  let lines = normalized.split('\n').map(line => {
    return line.replace(/[ \t]+/g, ' ').replace(/[ \t]+$/, '');
  });
  
  // 4. Trim leading and trailing whitespace & 5. Ignore extra blank lines at start/end
  normalized = lines.join('\n').trim();
  
  if (!opts.caseSensitive) {
    normalized = normalized.toLowerCase();
  }
  
  if (opts.ignorePunctuation) {
    normalized = normalized.replace(/[.,!?]/g, '');
  }
  
  return normalized;
}

// ── Similarity Check (Levenshtein Distance) ───────────────────────────────────

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[a.length][b.length];
}

function calculateSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 100;
  return ((maxLength - distance) / maxLength) * 100;
}

// ── Evaluation strategies ─────────────────────────────────────────────────────

/**
 * Compares two already normalised strings using a 3-step strategy.
 */
export function compareDebugOutput(expected: string, actual: string): { isMatch: boolean; reason: string } {
  // STEP 1: NORMALIZED EXACT MATCH
  if (expected === actual) {
    return { isMatch: true, reason: 'Accepted' };
  }

  // STEP 2: STRUCTURAL MATCH (LINE-BY-LINE)
  // Compare line-by-line ignoring minor spacing (e.g. leading spaces)
  const expectedLines = expected.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const actualLines = actual.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (expectedLines.length === actualLines.length && expectedLines.length > 0) {
    const allMatch = expectedLines.every((line, i) => line === actualLines[i]);
    if (allMatch) {
      return { isMatch: true, reason: 'Formatting differences ignored' };
    }
  }

  // STEP 3: SIMILARITY CHECK (SAFE FALLBACK)
  // If similarity > 95%, tolerate tiny mistakes
  const similarity = calculateSimilarity(expected, actual);
  if (similarity > 95) {
    return { isMatch: true, reason: 'Formatting differences ignored' };
  }

  return { isMatch: false, reason: 'Output mismatch' };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Evaluate a student's debug answer against the expected output.
 *
 * @param studentAnswer  Raw string submitted by the student
 * @param expectedOutput Expected output stored in the DB by the admin
 * @param maxMarks       Maximum marks for this question
 * @param opts           Matching options (caseSensitive, ignorePunctuation)
 */
export function evaluateDebugAnswer(
  studentAnswer: string,
  expectedOutput: string,
  maxMarks: number,
  opts: DebugEvalOptions = {},
): DebugEvalResult {
  const resolvedOpts: Required<DebugEvalOptions> = {
    caseSensitive: opts.caseSensitive ?? true,
    ignorePunctuation: opts.ignorePunctuation ?? false,
  };

  const normStudent = normalizeOutput(studentAnswer, resolvedOpts);
  const normExpected = normalizeOutput(expectedOutput, resolvedOpts);

  const { isMatch, reason } = compareDebugOutput(normExpected, normStudent);

  return {
    status: isMatch ? 'accepted' : 'wrong_answer',
    marks: isMatch ? maxMarks : 0,
    maxMarks,
    message: reason,
    meta: {
      studentAnswer,
      expectedOutput,
      normalised: {
        student: normStudent,
        expected: normExpected,
      },
    },
  };
}
