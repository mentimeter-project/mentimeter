'use client';

// ── Types ─────────────────────────────────────────────────────────────────────
interface TestResultItem {
  testCaseIndex: number;
  passed: boolean;
  status: string;
  errorOutput?: string | null;
}

interface FirstTestCaseDetails {
  status: 'Pass' | 'Fail';
  stdout: string | null;
  expectedOutput: string | null;  // only present on Fail
  compileOutput: string | null;
  stderr: string | null;
  executionStatus: string;
  time: string | null;
  memory: number | null;
}

export interface EvalResult {
  score: number;
  maxMarks: number;
  passed: number;
  total: number;
  compilationError: string | null;
  firstTestCaseDetails?: FirstTestCaseDetails;
  testResults: TestResultItem[];
}

interface EvalResultCardProps {
  result: EvalResult;
  isEvaluating?: boolean;   // show skeleton while waiting
  evaluatingStatusText?: string;
  onDismiss?: () => void;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/** Single terminal line with a label prefix */
function TermLine({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex gap-3 min-w-0">
      <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-widest w-24 pt-0.5 ${accent ?? 'text-slate-500'}`}>
        {label}
      </span>
      <pre className="text-slate-200 text-xs font-mono leading-relaxed whitespace-pre-wrap break-all flex-1 min-w-0">
        {value || <span className="text-slate-600 italic">(empty)</span>}
      </pre>
    </div>
  );
}

/** Pulsing skeleton shimmer line */
function SkeletonLine({ w = 'w-full' }: { w?: string }) {
  return <div className={`h-3 rounded ${w} bg-slate-700/60 animate-pulse`} />;
}

// ── Skeleton (shown while evaluating) ─────────────────────────────────────────
export function EvalResultSkeleton({ statusText = 'Processing...' }: { statusText?: string }) {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 overflow-hidden mt-4">
      {/* Header skeleton */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-700/50 flex flex-col gap-4">
        {statusText && (
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {statusText}
          </div>
        )}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-700/60 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonLine w="w-36" />
            <SkeletonLine w="w-24" />
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-9 h-9 rounded-xl bg-slate-700/60 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
      {/* Terminal skeleton */}
      <div className="bg-[#0a0f1a] px-5 py-4 space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex gap-1.5">
            {['bg-red-500/40', 'bg-yellow-500/40', 'bg-green-500/40'].map((c, i) => (
              <span key={i} className={`w-2.5 h-2.5 rounded-full ${c}`} />
            ))}
          </div>
          <SkeletonLine w="w-36" />
        </div>
        <div className="space-y-2.5">
          <SkeletonLine w="w-20" />
          <SkeletonLine w="w-3/4" />
          <SkeletonLine w="w-1/2" />
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function EvalResultCard({ result, isEvaluating, evaluatingStatusText, onDismiss }: EvalResultCardProps) {
  if (isEvaluating) return <EvalResultSkeleton statusText={evaluatingStatusText} />;

  const { score = 0, maxMarks = 0, passed = 0, total = 0, compilationError = null, firstTestCaseDetails, testResults = [] } = result || {};
  const allPassed   = passed === total && !compilationError;
  const nonePassed  = passed === 0 && !compilationError;
  const isPartial   = !allPassed && !nonePassed && !compilationError;
  const hasCompErr  = !!compilationError;
  const pct         = total > 0 ? Math.round((passed / total) * 100) : 0;

  // Theme tokens
  const theme = hasCompErr
    ? { border: 'border-red-500/30',    bg: 'bg-red-950/20',    badge: 'bg-red-500/15 text-red-400 border-red-500/25',    bar: 'bg-red-500', label: 'text-red-400',    emoji: '🔴', headline: 'Compilation Error' }
    : allPassed
    ? { border: 'border-emerald-500/30', bg: 'bg-emerald-950/15', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', bar: 'bg-emerald-500', label: 'text-emerald-400', emoji: '🎉', headline: 'All Tests Passed!' }
    : isPartial
    ? { border: 'border-amber-500/30',  bg: 'bg-amber-950/15',  badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25',  bar: 'bg-amber-500', label: 'text-amber-400',  emoji: '⚡', headline: `Partial — ${passed}/${total} Passed` }
    : { border: 'border-red-500/25',    bg: 'bg-red-950/15',    badge: 'bg-red-500/10 text-red-400 border-red-500/20',    bar: 'bg-red-500', label: 'text-red-400',    emoji: '❌', headline: 'No Tests Passed' };

  const tc1 = firstTestCaseDetails;

  return (
    <div
      className={`relative rounded-2xl border overflow-hidden mt-4 ${theme.border} ${theme.bg} backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-300`}
      role="alert"
    >
      {/* ── Dismiss ── */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 z-10 text-slate-500 hover:text-slate-300 text-sm leading-none transition-colors"
          aria-label="Dismiss result"
        >
          ✕
        </button>
      )}

      {/* ── Score Header ── */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-700/40">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl" role="img" aria-label={theme.headline}>{theme.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-base leading-tight ${theme.label}`}>{theme.headline}</p>
            <p className="text-slate-400 text-xs mt-1">
              Score:{' '}
              <span className={`font-bold text-sm ${theme.label}`}>{score}</span>
              <span className="text-slate-600"> / {maxMarks} marks</span>
              {tc1?.time && (
                <span className="text-slate-600 ml-2">· {parseFloat(tc1.time).toFixed(2)}s</span>
              )}
              {tc1?.memory && (
                <span className="text-slate-600 ml-1">· {Math.round(tc1.memory / 1024)}KB</span>
              )}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        {!hasCompErr && (
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1.5">
              <span>Test Cases</span>
              <span>{passed}/{total} ({pct}%)</span>
            </div>
            <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${theme.bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Test case badges */}
        {testResults.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {testResults.map((tr) => (
              <span
                key={tr.testCaseIndex}
                title={tr.status}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${
                  tr.passed
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}
              >
                <span className="font-bold">{tr.passed ? '✓' : '✗'}</span>
                TC{tr.testCaseIndex}
                {!tr.passed && (
                  <span className="opacity-60 pl-0.5 border-l border-current/20 ml-0.5">
                    {tr.status.replace(/\s*\(.*\)/, '')}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Terminal Output Panel ── */}
      <div className="bg-[#060d1a] font-mono">
        {/* Terminal chrome bar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-[#0d1525] border-b border-slate-700/40">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          </div>
          <span className="text-slate-500 text-[10px] ml-1">
            Execution Output — Test Case 1{' '}
            {tc1 && (
              <span className={tc1.status === 'Pass' ? 'text-emerald-500' : 'text-red-400'}>
                [{tc1.executionStatus}]
              </span>
            )}
          </span>
        </div>

        <div className="px-5 py-4 space-y-3 min-h-[100px]">
          {/* Compilation Error */}
          {hasCompErr && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">
                Compiler Output
              </span>
              <pre className="text-red-300 text-xs leading-relaxed whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                {compilationError}
              </pre>
            </div>
          )}

          {/* TC1 runtime output */}
          {!hasCompErr && tc1 && (
            <div className="space-y-3">
              {/* Actual stdout */}
              <TermLine
                label="Your Output"
                value={tc1.stdout ?? ''}
                accent={tc1.status === 'Pass' ? 'text-emerald-500' : 'text-slate-400'}
              />

              {/* Expected output (only shown on fail) */}
              {tc1.status === 'Fail' && tc1.expectedOutput !== null && (
                <TermLine
                  label="Expected"
                  value={tc1.expectedOutput}
                  accent="text-amber-400"
                />
              )}

              {/* Runtime stderr */}
              {tc1.stderr && (
                <div className="border-t border-slate-700/40 pt-3">
                  <TermLine label="Stderr" value={tc1.stderr} accent="text-red-400" />
                </div>
              )}

              {/* No output at all */}
              {!tc1.stdout && !tc1.stderr && !tc1.compileOutput && (
                <span className="text-slate-600 text-xs italic">No output produced.</span>
              )}
            </div>
          )}

          {/* No firstTestCaseDetails (older result) — show legacy runtime errors per test */}
          {!hasCompErr && !tc1 && testResults.length > 0 && testResults[0].errorOutput && (
            <TermLine label="Stderr" value={testResults[0].errorOutput} accent="text-red-400" />
          )}

          {/* Pass indicator */}
          {!hasCompErr && tc1?.status === 'Pass' && (
            <div className="flex items-center gap-2 mt-1 text-emerald-400 text-xs font-semibold">
              <span className="text-base">✓</span>
              Output matches expected — Test Case 1 passed!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
