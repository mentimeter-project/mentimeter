/**
 * @file src/app/api/execute/route.ts
 *
 * Generic code execution endpoint backed by Piston API v2.
 *
 * POST /api/execute
 *
 * Request body (JSON):
 * {
 *   "source_code": "print('hello')",   // required
 *   "language":    "python",            // required — generic name OR Piston alias
 *   "version":     "3.12.0",            // optional — auto-resolved if omitted
 *   "stdin":       "42\n",             // optional
 *   "args":        ["--flag", "value"] // optional
 * }
 *
 * Response body (JSON) — normalised Judge0-style shape:
 * {
 *   "language":        "python",
 *   "version":         "3.12.0",
 *   "status":          { "id": 3, "description": "Accepted" },
 *   "stdout":          "hello\n",
 *   "stderr":          null,
 *   "compile_output":  null,
 *   "time":            null,
 *   "memory":          null
 * }
 *
 * This endpoint is intentionally unauthenticated so it can be used from
 * the admin code-editor preview or tested with curl.  If you want to
 * restrict access, add session-guard logic from evaluate-submission/route.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  executePistonTimed,
  normalisePistonResponse,
  resolveLanguageVersion,
  type NormalisedResult,
} from '@/lib/piston';

// ── Request shape ────────────────────────────────────────────────────────────

interface ExecuteRequestBody {
  source_code: string;
  language: string;
  version?: string;
  stdin?: string;
  args?: string[];
}

// ── Response shape ───────────────────────────────────────────────────────────

interface ExecuteResponseBody extends NormalisedResult {
  language: string;
  version: string;
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Parse + validate the request body
  let body: ExecuteRequestBody;
  try {
    body = (await req.json()) as ExecuteRequestBody;
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  const { source_code, language, version, stdin, args } = body;

  if (typeof source_code !== 'string' || !source_code.trim()) {
    return NextResponse.json(
      { error: '`source_code` is required and must be a non-empty string.' },
      { status: 400 }
    );
  }

  if (typeof language !== 'string' || !language.trim()) {
    return NextResponse.json(
      { error: '`language` is required and must be a non-empty string.' },
      { status: 400 }
    );
  }

  if (args !== undefined && !Array.isArray(args)) {
    return NextResponse.json(
      { error: '`args` must be an array of strings when provided.' },
      { status: 400 }
    );
  }

  // 2. Resolve the language version (uses cached runtimes — no extra network
  //    hit unless the Next.js cache has expired).
  let resolvedLanguage: string;
  let resolvedVersion: string;

  try {
    const resolved = await resolveLanguageVersion(version ? language : language);
    resolvedLanguage = resolved.language;
    resolvedVersion = version ?? resolved.version;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Language not found in Piston runtime list
    if (msg.includes('not supported')) {
      return NextResponse.json({ error: msg }, { status: 422 });
    }
    return NextResponse.json(
      { error: `Failed to resolve language runtime: ${msg}` },
      { status: 502 }
    );
  }

  // 3. Execute on Piston (timed)
  let pistonTimed: Awaited<ReturnType<typeof executePistonTimed>>;
  try {
    pistonTimed = await executePistonTimed({
      sourceCode: source_code,
      language: resolvedLanguage,
      version: resolvedVersion,
      stdin,
      args,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[execute] Piston error:', msg);

    if (msg.includes('network error') || msg.includes('Failed to fetch')) {
      return NextResponse.json(
        { error: 'Cannot reach the Piston execution service. Check PISTON_API_URL.' },
        { status: 502 }
      );
    }
    if (msg.toLowerCase().includes('timeout') || msg.includes('TimeoutError')) {
      return NextResponse.json(
        { error: 'Execution timed out. Your code may contain an infinite loop.' },
        { status: 504 }
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // 4. Normalise into Judge0-style shape.
  //    No expectedOutput here — this is a raw "run" endpoint; the caller
  //    decides whether the output is correct.
  const { response: pistonRaw, wallClockMs } = pistonTimed;
  const normalised = normalisePistonResponse(pistonRaw, undefined, wallClockMs);

  const response: ExecuteResponseBody = {
    language: pistonRaw.language,
    version: pistonRaw.version,
    ...normalised,
  };

  return NextResponse.json(response, { status: 200 });
}

// GET /api/execute — returns supported runtimes (handy for debugging / admin UI)
export async function GET(): Promise<NextResponse> {
  try {
    const { fetchPistonRuntimes } = await import('@/lib/piston');
    const runtimes = await fetchPistonRuntimes();
    return NextResponse.json({ runtimes }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to fetch runtimes: ${msg}` },
      { status: 502 }
    );
  }
}
