/**
 * @file src/lib/piston.ts
 *
 * Piston API v2 — helper utilities for code execution.
 *
 * Configured for a self-hosted local Piston instance (Docker).
 *
 * Responsibilities:
 *   1. TypeScript types for Piston request/response payloads and the
 *      normalised Judge0-style object that the SQLite schema expects.
 *   2. Runtime caching — fetches /api/v2/runtimes once per revalidation
 *      window using Next.js 14's native fetch cache (no external lib needed).
 *   3. Language-name → version resolution ("python" → "3.12.0").
 *   4. Execution wrapper around /api/v2/execute.
 *   5. Judge0-parity formatter that normalises Piston's split compile/run
 *      output back into the shape the existing frontend and DB expect.
 *   6. Health check utility.
 */

// No external dependencies needed — rate limiter is in-memory.

// ─────────────────────────────────────────────────────────────────────────────
// § 1  Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base URL of the self-hosted Piston instance.
 * Set PISTON_BASE in .env.local to point at your Docker container.
 * Default: http://localhost:2000
 */
const PISTON_BASE =
  (process.env.PISTON_BASE ?? 'http://localhost:2000').replace(/\/$/, '');

/** Optional API key forwarded as X-Piston-Key (only needed on private servers). */
const PISTON_KEY = process.env.PISTON_API_KEY ?? '';

/** How many seconds Next.js should cache the runtimes list before revalidating.
 *  Piston runtimes rarely change — 6 hours is a safe default.
 */
const RUNTIMES_REVALIDATE_SECONDS = 6 * 60 * 60; // 6 h

/** Hard timeout for the /execute call (ms). Prevents hanging Next.js handlers. */
const EXECUTE_TIMEOUT_MS = 20_000; // 20 s

/** Constructs a versioned API endpoint. */
const getEndpoint = (path: string) =>
  `${PISTON_BASE}/api/v2/${path.replace(/^\/+/, '')}`;

// ─────────────────────────────────────────────────────────────────────────────
// § 2  Piston-native TypeScript interfaces
// ─────────────────────────────────────────────────────────────────────────────

/** A single file passed to Piston. Only `content` is required for single-file runs. */
export interface PistonFile {
  name?: string;
  content: string;
  encoding?: 'utf8' | 'base64' | 'hex';
}

/** Shape returned by GET /api/v2/runtimes */
export interface PistonRuntime {
  language: string;
  version: string;
  aliases: string[];
  runtime?: string;
}

/** Payload sent to POST /api/v2/execute */
export interface PistonExecuteRequest {
  language: string;
  version: string;
  files: PistonFile[];
  stdin?: string;
  args?: string[];
  compile_timeout?: number; // ms, default 10 000
  run_timeout?: number;     // ms, default 3 000
  compile_memory_limit?: number; // bytes, -1 = unlimited
  run_memory_limit?: number;     // bytes, -1 = unlimited
}

/** Per-stage output inside a Piston execute response */
export interface PistonStageOutput {
  stdout: string;
  stderr: string;
  output: string; // merged stdout + stderr
  code: number | null;   // process exit code
  signal: string | null; // e.g. "SIGKILL" on TLE
}

/** Full response from POST /api/v2/execute */
export interface PistonExecuteResponse {
  language: string;
  version: string;
  run: PistonStageOutput;
  compile?: PistonStageOutput; // absent for interpreted languages
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3  Normalised Judge0-style response (DB + frontend contract)
// ─────────────────────────────────────────────────────────────────────────────

/** Numeric status IDs that mirror the Judge0 convention used by the existing
 *  SQLite schema and frontend. Adding new IDs here is safe — the DB stores the
 *  description string, not the numeric ID.
 */
export const PISTON_STATUS = {
  ACCEPTED: 3,
  WRONG_ANSWER: 4,
  TIME_LIMIT_EXCEEDED: 5,
  COMPILATION_ERROR: 6,
  RUNTIME_ERROR_SIGSEGV: 11,
  INTERNAL_ERROR: 13,
} as const;

export type PistonStatusId = (typeof PISTON_STATUS)[keyof typeof PISTON_STATUS];

/** The normalised response shape that matches what `evaluate-submission/route.ts`
 *  already reads: `status.id`, `stdout`, `stderr`, `compile_output`, `time`, `memory`.
 */
export interface NormalisedResult {
  status: {
    id: PistonStatusId;
    description: string;
  };
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  time: string | null;   // seconds as string, e.g. "0.042" — mirrors Judge0
  memory: number | null; // KB — mirrors Judge0
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4  Judge0 language_id → Piston language name map
//
//  The existing DB stores Judge0 language IDs (integers).  This map lets the
//  evaluate-submission route convert the stored integer into a Piston language
//  name string without touching the DB schema.
//
//  IMPORTANT: Local Piston uses different language names than emkc:
//    - "javascript" / "js" → "node" (JavaScript runtime is "node" in Piston packages)
//    - "c" / "c++" → "gcc"  (Piston ships a unified gcc package)
//    - "csharp" → "mono"
//
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps the Judge0 language_id integers your DB/frontend already use to the
 * canonical Piston language name accepted by /api/v2/runtimes.
 *
 * Add / adjust entries if your assessment uses additional languages.
 * Full Judge0 language list: https://ce.judge0.com/languages/
 */
export const JUDGE0_ID_TO_PISTON_LANG: Record<number, string> = {
  // ── Python ────────────────────────────────────────────
  // Runtime: "python" | aliases: py, py3, python3, python3.12
  71:  'python',   // Python 3
  70:  'python',   // Python 2  (Piston will pick latest Python 2.x)
  // ── JavaScript / Node.js ──────────────────────────────
  // Runtime: "javascript" | aliases: node-javascript, node-js, js
  63:  'javascript',
  // ── TypeScript ────────────────────────────────────────
  // Runtime: "typescript" | aliases: ts, node-ts, tsc, typescript5
  74:  'typescript',
  // ── Java ──────────────────────────────────────────────
  // Runtime: "java" | aliases: none
  62:  'java',
  // ── C ─────────────────────────────────────────────────
  // Runtime: "c" | aliases: gcc
  50:  'c',
  75:  'c',
  // ── C++ ───────────────────────────────────────────────
  // Runtime: "c++" | aliases: cpp, g++
  54:  'c++',
  76:  'c++',
  // ── C# ────────────────────────────────────────────────
  // Runtime: "csharp" | aliases: mono, mono-csharp, c#, cs
  51:  'csharp',
  // ── Go ────────────────────────────────────────────────
  60:  'go',
  // ── Rust ──────────────────────────────────────────────
  // Runtime: "rust" | aliases: rs
  73:  'rust',
  // ── Kotlin ────────────────────────────────────────────
  // Runtime: "kotlin" | aliases: kt
  78:  'kotlin',
  // ── Ruby ──────────────────────────────────────────────
  // Runtime: "ruby" | aliases: ruby3, rb
  72:  'ruby',
  // ── PHP ───────────────────────────────────────────────
  // Runtime: "php" | aliases: none
  68:  'php',
  // ── Swift ─────────────────────────────────────────────
  83:  'swift',
  // ── Bash ──────────────────────────────────────────────
  // Runtime: "bash" | aliases: sh
  46:  'bash',
};

// ─────────────────────────────────────────────────────────────────────────────
// § 5  Shared fetch headers
// ─────────────────────────────────────────────────────────────────────────────

function pistonHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (PISTON_KEY) headers['X-Piston-Key'] = PISTON_KEY;
  return headers;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6  Health check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calls GET /api/v2/runtimes and returns true if Piston responds correctly.
 * Use this before accepting submissions to give a fast-fail error.
 */
export async function checkPistonHealth(): Promise<boolean> {
  try {
    const url = getEndpoint('runtimes');
    const res = await fetch(url, {
      method: 'GET',
      headers: pistonHeaders(),
      cache: 'no-store',
      // @ts-ignore — AbortSignal.timeout is available in Node 17+
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data);
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7  Runtime cache utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the full list of runtimes supported by the configured Piston instance.
 *
 * Next.js 14's `fetch` caching is used: the response is stored in the Data
 * Cache and revalidated every `RUNTIMES_REVALIDATE_SECONDS` seconds.  This
 * means *at most one* upstream call per revalidation window, no matter how
 * many execution requests fire concurrently.
 */
export async function fetchPistonRuntimes(): Promise<PistonRuntime[]> {
  const url = getEndpoint('runtimes');

  const res = await fetch(url, {
    method: 'GET',
    headers: pistonHeaders(),
    // ✅ Next.js 14 Data Cache — cached on the server, revalidated periodically.
    next: { revalidate: RUNTIMES_REVALIDATE_SECONDS },
    // @ts-ignore — AbortSignal.timeout is available in Node 17+
    signal: AbortSignal.timeout(10_000), // 10s hard limit — prevents worker hangs
  });

  const text = await res.text();
  console.log(`[Piston] RAW RUNTIMES RESPONSE:`, text);

  if (!text || text.trim() === "") {
    console.error(`[Piston] Empty response from runtimes API (HTTP ${res.status})`);
    return []; // Return empty instead of crashing
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    console.error(`[Piston] Invalid JSON from runtimes API:`, text);
    return []; // Return empty instead of crashing
  }

  if (!res.ok) {
    throw new Error(
      `Piston runtimes fetch failed (HTTP ${res.status}): ${text.slice(0, 300)}`
    );
  }

  return data as PistonRuntime[];
}

/**
 * Resolves a generic language name (e.g. "python") to the **latest** version
 * string available on the Piston instance (e.g. "3.12.0").
 *
 * Matching is case-insensitive and also checks the `aliases` array (so
 * "js", "node", "nodejs" all resolve to the Node.js runtime).
 *
 * @throws {Error} if the language is not supported by the instance.
 */
export async function resolveLanguageVersion(
  language: string
): Promise<{ language: string; version: string }> {
  const runtimes = await fetchPistonRuntimes();
  const target = language.toLowerCase().trim();

  // Filter all runtimes that match by language name or alias
  const matches = runtimes.filter(
    (rt) =>
      rt.language.toLowerCase() === target ||
      rt.aliases.some((a) => a.toLowerCase() === target)
  );

  if (matches.length === 0) {
    const supported = Array.from(new Set(runtimes.map((r) => r.language))).sort().join(', ');
    throw new Error(
      `Language "${language}" is not supported by this Piston instance. ` +
        `Supported languages: ${supported}`
    );
  }

  // Pick the lexicographically latest version (semver-ish sort works for
  // the version strings Piston uses).
  matches.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  const best = matches[0];

  return { language: best.language, version: best.version };
}

/**
 * Convenience wrapper: accepts a Judge0 language_id integer and returns
 * the resolved Piston { language, version } pair.
 *
 * @throws {Error} if the ID is not in JUDGE0_ID_TO_PISTON_LANG.
 */
export async function resolveFromJudge0Id(
  judge0LanguageId: number
): Promise<{ language: string; version: string }> {
  const pistonLang = JUDGE0_ID_TO_PISTON_LANG[judge0LanguageId];
  if (!pistonLang) {
    throw new Error(
      `Judge0 language_id ${judge0LanguageId} has no Piston mapping. ` +
        `Add it to JUDGE0_ID_TO_PISTON_LANG in src/lib/piston.ts.`
    );
  }
  return resolveLanguageVersion(pistonLang);
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8  Execution Queue & Rate Limiter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A simple concurrency queue to prevent overwhelming the local Piston instance.
 * Next.js handles requests concurrently, so this global queue ensures we never
 * have more than maxConcurrent running at once.
 */
class ConcurrencyQueue {
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(private maxConcurrent: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    } else {
      this.active--;
    }
  }
}

// Allow max 4 parallel execution requests to the Docker container
const executionQueue = new ConcurrencyQueue(4);

/**
 * In-memory rate limiter.
 * Limits students (by ID) to 15 submissions per 60-second window.
 * No Redis dependency — works for single-instance deployments.
 */
const rateLimitMap = new Map<number, { count: number; expiresAt: number }>();

export async function checkRateLimit(studentId: number): Promise<boolean> {
  const windowMs = 60_000;
  const maxRequests = 15;
  const now = Date.now();

  const entry = rateLimitMap.get(studentId);
  if (!entry || now >= entry.expiresAt) {
    rateLimitMap.set(studentId, { count: 1, expiresAt: now + windowMs });
    return true;
  }

  entry.count++;
  return entry.count <= maxRequests;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9  Execution
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecuteOptions {
  /** Plain-text source code */
  sourceCode: string;
  /** Generic language name ("python", "node", "gcc") or already-resolved name */
  language: string;
  /** Specific version string.  If omitted, resolveLanguageVersion is called. */
  version?: string;
  /** stdin fed to the program */
  stdin?: string;
  /** CLI arguments */
  args?: string[];
  /** Per-stage timeout in ms (default 10 000 ms for compile, 10 000 ms for run) */
  timeoutMs?: number;
  /** Per-stage memory limit in MB (default 256MB, -1 for unlimited) */
  runMemoryLimitMB?: number;
}

/**
 * Executes source code on Piston and returns the raw PistonExecuteResponse.
 * Callers that need a Judge0-compatible shape should pass the result to
 * `normalisePistonResponse`.
 */
export async function executePiston(
  opts: ExecuteOptions
): Promise<PistonExecuteResponse> {
  await executionQueue.acquire();
  try {
    // Resolve version if not explicitly provided
    const resolved = opts.version
      ? { language: opts.language, version: opts.version }
      : await resolveLanguageVersion(opts.language);

    const timeout = opts.timeoutMs ?? 10_000;
    
    // Default memory limit: 256MB. Convert to bytes for Piston.
    const memoryBytes = opts.runMemoryLimitMB === -1 
      ? -1 
      : (opts.runMemoryLimitMB ?? 256) * 1024 * 1024;

    const payload: PistonExecuteRequest = {
      language: resolved.language,
      version: resolved.version,
      files: [{ content: opts.sourceCode }],
      ...(opts.stdin !== undefined && { stdin: opts.stdin }),
      ...(opts.args?.length && { args: opts.args }),
      compile_timeout: timeout,
      run_timeout: Math.min(timeout, 3000),
      compile_memory_limit: memoryBytes,
      run_memory_limit: memoryBytes,
    };

    const url = getEndpoint('execute');

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: pistonHeaders(),
        body: JSON.stringify(payload),
        // Execution responses must NOT be cached — each submission is unique.
        cache: 'no-store',
        // @ts-ignore — AbortSignal.timeout is available in Node 17+ / Next 14
        signal: AbortSignal.timeout(EXECUTE_TIMEOUT_MS),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Piston network error (${url}): ${msg}`
      );
    }

    const text = await res.text();
    console.log(`[Piston] RAW EXECUTION RESPONSE:`, text);

    if (!text || text.trim() === "") {
      throw new Error(`Empty response from Piston execution engine (HTTP ${res.status})`);
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error(`[Piston] Invalid JSON from execution engine:`, text);
      throw new Error(
        `Execution engine returned malformed response. Please try again.`
      );
    }

    if (!res.ok) {
      throw new Error(
        `Piston execute failed (HTTP ${res.status}) at ${url}: ${text.slice(0, 300)}`
      );
    }

    // Validate structure
    if (!data || (!data.run && !data.compile)) {
        throw new Error("Execution failed or invalid response structure from Piston");
    }

    return data as PistonExecuteResponse;
  } finally {
    executionQueue.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9a  Timed execution wrapper
// ─────────────────────────────────────────────────────────────────────────────

/** Result from executePistonTimed including wall-clock timing. */
export interface TimedExecutionResult {
  response: PistonExecuteResponse;
  /** Wall-clock milliseconds the execution took (network + compile + run). */
  wallClockMs: number;
}

/**
 * Wraps {@link executePiston} with high-resolution wall-clock timing.
 * Returns both the raw Piston response and the elapsed time in milliseconds.
 */
export async function executePistonTimed(
  opts: ExecuteOptions
): Promise<TimedExecutionResult> {
  const start = performance.now();
  const response = await executePiston(opts);
  const wallClockMs = Math.round(performance.now() - start);
  return { response, wallClockMs };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9b  Judge0-parity formatter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalises a raw Piston response into the Judge0-style object that the
 * existing `evaluate-submission` route, frontend, and SQLite schema expect.
 *
 * Mapping logic:
 *
 * | Piston condition                          | Judge0 status id |
 * |-------------------------------------------|--------------------|
 * | compile stage exited non-zero             | 6  Compilation Error |
 * | run stage killed by signal (TLE/MLE)      | 5  Time Limit Exceeded |
 * | run stage exited non-zero                 | 11 Runtime Error |
 * | run stage exited 0                        | 3  Accepted* |
 *
 * *"Accepted" here means the program ran to completion without error.
 *  Correct-output checking (status 4 Wrong Answer) is done by the caller
 *  (evaluate-submission) by comparing stdout to expected_output — exactly
 *  as it did with Judge0.
 *
 * @param raw  - The raw PistonExecuteResponse from executePiston().
 * @param expectedOutput - Optional; if supplied, the formatter will downgrade
 *   status 3 → 4 (Wrong Answer) when stdout doesn't match.  Pass `undefined`
 *   to skip output comparison (the generic /api/execute endpoint does this).
 */
export function normalisePistonResponse(
  raw: PistonExecuteResponse,
  expectedOutput?: string,
  wallClockMs?: number,
): NormalisedResult {
  const compile = raw.compile ?? null;
  const run = raw.run;
  const timeStr = wallClockMs != null ? (wallClockMs / 1000).toFixed(3) : null;

  // ── Compile error ────────────────────────────────────────────────────────
  if (compile && compile.code !== 0 && compile.code !== null) {
    return {
      status: { id: PISTON_STATUS.COMPILATION_ERROR, description: 'Compilation Error' },
      stdout: null,
      stderr: compile.stderr || null,
      compile_output: (compile.stderr || compile.stdout || compile.output || 'Compilation failed').trim() || null,
      time: timeStr,
      memory: null,
    };
  }

  // ── Killed by signal (TLE / MLE / OOM) ──────────────────────────────────
  if (run.signal) {
    return {
      status: { id: PISTON_STATUS.TIME_LIMIT_EXCEEDED, description: 'Time Limit Exceeded' },
      stdout: run.stdout || null,
      stderr: run.stderr || run.signal,
      compile_output: compile?.stdout?.trim() || null,
      time: timeStr,
      memory: null,
    };
  }

  // ── Non-zero exit code → Runtime Error ───────────────────────────────────
  if (run.code !== 0 && run.code !== null) {
    return {
      status: { id: PISTON_STATUS.RUNTIME_ERROR_SIGSEGV, description: 'Runtime Error' },
      stdout: run.stdout || null,
      stderr: run.stderr || null,
      compile_output: compile?.stdout?.trim() || null,
      time: timeStr,
      memory: null,
    };
  }

  // ── Successful execution — check output if expected is provided ──────────
  const stdout = run.stdout ?? '';

  if (expectedOutput !== undefined) {
    let isMatch = false;
    const actualTrimmed = stdout.trim();
    const expectedTrimmed = expectedOutput.trim();

    if (actualTrimmed === expectedTrimmed) {
      isMatch = true;
    } else {
      // Normalize whitespace
      const normalizeWS = (s: string) => s.replace(/\\s+/g, ' ');
      if (normalizeWS(actualTrimmed) === normalizeWS(expectedTrimmed)) {
        isMatch = true;
      } else {
        // Handle Arrays / JSON & floating point tolerance
        try {
          const actualJson = JSON.parse(actualTrimmed);
          const expectedJson = JSON.parse(expectedTrimmed);

          if (Array.isArray(actualJson) && Array.isArray(expectedJson)) {
            if (actualJson.length === expectedJson.length) {
              isMatch = actualJson.every((val, i) => {
                const eVal = expectedJson[i];
                if (typeof val === 'number' && typeof eVal === 'number') {
                  return Math.abs(val - eVal) < 1e-6;
                }
                return val === eVal;
              });
            }
          } else if (typeof actualJson === 'number' && typeof expectedJson === 'number') {
            isMatch = Math.abs(actualJson - expectedJson) < 1e-6;
          }
        } catch {
          // Fallback if not JSON: already false
        }
      }
    }

    if (!isMatch) {
      return {
        status: { id: PISTON_STATUS.WRONG_ANSWER, description: 'Wrong Answer' },
        stdout: stdout || null,
        stderr: run.stderr || null,
        compile_output: compile?.stdout?.trim() || null,
        time: timeStr,
        memory: null,
      };
    }
  }

  return {
    status: { id: PISTON_STATUS.ACCEPTED, description: 'Accepted' },
    stdout: stdout || null,
    stderr: run.stderr || null,
    compile_output: compile?.stdout?.trim() || null,
    time: timeStr,
    memory: null,
  };
}
