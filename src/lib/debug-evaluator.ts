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
  /** If true, normalise all internal whitespace runs to a single space. Default: false */
  ignoreWhitespace?: boolean;
}

export interface DebugEvalResult {
  status: DebugEvalStatus;
  /** Marks awarded (either maxMarks or 0 in the current strict strategy) */
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

function normalise(raw: string, opts: Required<DebugEvalOptions>): string {
  let s = raw.trim();
  if (!opts.caseSensitive) s = s.toLowerCase();
  if (opts.ignoreWhitespace) s = s.replace(/\s+/g, ' ');
  return s;
}

// ── Evaluation strategies ─────────────────────────────────────────────────────

/**
 * Strict (all-or-nothing) strategy.
 * Returns full marks on exact match, zero otherwise.
 *
 * Future strategies to add:
 *   - partialLineStrategy(student, expected, opts)  → partial per matching line
 *   - tokenStrategy(student, expected, opts)        → token-overlap ratio
 */
function strictStrategy(
  normalisedStudent: string,
  normalisedExpected: string,
  maxMarks: number,
): { marks: number; status: DebugEvalStatus; message: string } {
  if (normalisedStudent === normalisedExpected) {
    return {
      marks: maxMarks,
      status: 'accepted',
      message: 'Output matches expected. Full marks awarded.',
    };
  }
  return {
    marks: 0,
    status: 'wrong_answer',
    message: 'Output does not match expected. Zero marks awarded.',
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Evaluate a student's debug answer against the expected output.
 *
 * @param studentAnswer  Raw string submitted by the student
 * @param expectedOutput Expected output stored in the DB by the admin
 * @param maxMarks       Maximum marks for this question
 * @param opts           Matching options (caseSensitive, ignoreWhitespace)
 */
export function evaluateDebugAnswer(
  studentAnswer: string,
  expectedOutput: string,
  maxMarks: number,
  opts: DebugEvalOptions = {},
): DebugEvalResult {
  const resolvedOpts: Required<DebugEvalOptions> = {
    caseSensitive: opts.caseSensitive ?? true,
    ignoreWhitespace: opts.ignoreWhitespace ?? false,
  };

  const normStudent = normalise(studentAnswer, resolvedOpts);
  const normExpected = normalise(expectedOutput, resolvedOpts);

  const { marks, status, message } = strictStrategy(normStudent, normExpected, maxMarks);

  return {
    status,
    marks,
    maxMarks,
    message,
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
