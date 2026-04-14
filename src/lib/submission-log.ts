/**
 * @file src/lib/submission-log.ts
 *
 * Helpers for the `submission_logs` table — tracks every code evaluation
 * through its lifecycle (running → completed / error) with timing data.
 */

import db from './db';

/**
 * Creates a new submission log entry with status 'queued'.
 * Returns the log row ID for later updates.
 */
export function enqueueSubmissionLog(
  studentId: number,
  questionId: number,
  languageId: number,
  totalTestCases: number,
): number {
  const result = db.prepare(
    `INSERT INTO submission_logs
       (student_id, question_id, language_id, status, test_cases_total, created_at)
     VALUES (?, ?, ?, 'queued', ?, datetime('now'))`
  ).run(studentId, questionId, languageId, totalTestCases);
  return Number(result.lastInsertRowid);
}

/**
 * Marks a queued log as 'running' once the worker picks it up.
 */
export function startSubmissionLog(logId: number): void {
  db.prepare(
    `UPDATE submission_logs
     SET status = 'running',
         started_at = datetime('now')
     WHERE id = ?`
  ).run(logId);
}

/**
 * Marks a submission log as 'completed' with results and the full evaluated JSON tree.
 */
export function completeSubmissionLog(
  logId: number,
  testCasesCompleted: number,
  executionTimeMs: number,
  resultPayload: string,
): void {
  db.prepare(
    `UPDATE submission_logs
     SET status = 'completed',
         test_cases_completed = ?,
         execution_time_ms = ?,
         result_payload = ?,
         completed_at = datetime('now')
     WHERE id = ?`
  ).run(testCasesCompleted, executionTimeMs, resultPayload, logId);
}

/**
 * Marks a submission log as 'error' with a message.
 */
export function failSubmissionLog(
  logId: number,
  errorMessage: string,
): void {
  db.prepare(
    `UPDATE submission_logs
     SET status = 'error',
         error_message = ?,
         completed_at = datetime('now')
     WHERE id = ?`
  ).run(errorMessage, logId);
}
