'use client';

import { motion, AnimatePresence } from 'framer-motion';

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
  expectedOutput: string | null;
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
  userName?: string;
  isEvaluating?: boolean;
  evaluatingStatusText?: string;
  onDismiss?: () => void;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TermLine({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex gap-4 min-w-0 py-1.5">
      <span className={`flex-shrink-0 text-[10px] font-black uppercase tracking-[0.2em] w-24 pt-1 ${accent ?? 'text-slate-500 dark:text-slate-400'}`}>
        {label}
      </span>
      <pre className="text-slate-300 text-xs font-mono leading-relaxed whitespace-pre-wrap break-all flex-1 min-w-0 bg-black/40 p-3 rounded-xl border border-white/5 shadow-sm">
        {value || <span className="text-slate-600 italic opacity-50">(empty)</span>}
      </pre>
    </div>
  );
}

function SkeletonLine({ w = 'w-full' }: { w?: string }) {
  return <div className={`h-3 rounded-lg ${w} bg-slate-800/40 animate-pulse`} />;
}

export function EvalResultSkeleton({ statusText = 'Processing...' }: { statusText?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-premium overflow-hidden mt-6 rounded-3xl border border-indigo-500/10">
      <div className="px-6 py-6 border-b border-white/5 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-indigo-400 text-[10px] font-black uppercase tracking-widest">
          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          {statusText}
        </div>
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-slate-700/30 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <SkeletonLine w="w-48" />
            <SkeletonLine w="w-32" />
          </div>
        </div>
      </div>
      <div className="bg-black/20 px-6 py-6 space-y-4">
        <SkeletonLine w="w-1/2" />
        <SkeletonLine w="w-full" />
        <SkeletonLine w="w-3/4" />
      </div>
    </motion.div>
  );
}

export default function EvalResultCard({ result, userName, isEvaluating, evaluatingStatusText, onDismiss }: EvalResultCardProps) {
  if (isEvaluating) return <EvalResultSkeleton statusText={evaluatingStatusText} />;

  const { score = 0, maxMarks = 0, passed = 0, total = 0, compilationError = null, firstTestCaseDetails, testResults = [] } = result || {};
  const allPassed = passed === total && !compilationError;
  const nonePassed = passed === 0 && !compilationError;
  const isPartial = !allPassed && !nonePassed && !compilationError;
  const hasCompErr = !!compilationError;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

  const theme = hasCompErr
    ? { border: 'border-red-500/20', bg: 'bg-red-500/5', badge: 'bg-red-500/10 text-red-400 border-red-500/20', bar: 'bg-red-500', label: 'text-red-400', emoji: '🔴', headline: 'Execution Error' }
    : allPassed
    ? { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', bar: 'bg-emerald-500', label: 'text-emerald-400', emoji: '🎉', headline: `Well done, ${userName || 'there'}!` }
    : isPartial
    ? { border: 'border-amber-500/20', bg: 'bg-amber-500/5', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', bar: 'bg-amber-500', label: 'text-amber-400', emoji: '⚡', headline: `Almost there, ${userName || 'there'}!` }
    : { border: 'border-red-500/20', bg: 'bg-red-500/5', badge: 'bg-red-500/10 text-red-400 border-red-500/20', bar: 'bg-red-500', label: 'text-red-400', emoji: '❌', headline: `Nice try, ${userName || 'there'}!` };

  const tc1 = firstTestCaseDetails;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className={`relative rounded-3xl border overflow-hidden mt-6 glass-premium ${theme.border} ${theme.bg}`}>
      {onDismiss && (
        <button onClick={onDismiss} className="absolute top-5 right-5 z-20 w-8 h-8 flex items-center justify-center rounded-xl bg-black/40 text-slate-400 hover:text-white transition-all font-black text-xs">✕</button>
      )}

      <div className="px-8 pt-8 pb-6 border-b border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-current opacity-[0.03] rounded-full -mr-12 -mt-12 pointer-events-none" style={{ color: allPassed ? '#10b981' : hasCompErr ? '#ef4444' : '#f59e0b' }} />
        
        <div className="flex items-center gap-6 mb-6">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-2xl ${theme.badge}`}>
            {theme.emoji}
          </div>
          <div className="flex-1">
            <h3 className={`text-2xl font-black tracking-tight ${theme.label}`}>{theme.headline}</h3>
            <div className="flex items-center gap-3 mt-1.5 text-slate-500 text-xs font-bold uppercase tracking-widest">
              <span>Your Score: <span className={theme.label}>{score}</span> / {maxMarks}</span>
              {tc1?.time && <span className="opacity-40">·</span>}
              {tc1?.time && <span>{parseFloat(tc1.time).toFixed(3)}s</span>}
            </div>
            {allPassed && <p className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-[0.15em] mt-2">Your solution was evaluated successfully.</p>}
            {!allPassed && !hasCompErr && <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-[0.15em] mt-2">Check your logic and try again 💡</p>}
          </div>
        </div>

        {!hasCompErr && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 px-1">
              <span>Progress Output</span>
              <span>{passed} / {total} Passed</span>
            </div>
            <div className="h-3 bg-slate-100 dark:bg-black/30 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-white/5">
              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className={`h-full rounded-full shadow-lg ${theme.bar}`} />
            </div>
          </div>
        )}

        {testResults.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-6">
            {testResults.map((tr) => (
              <motion.span whileHover={{ y: -2 }} key={tr.testCaseIndex} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${
                tr.passed ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                <span className="text-sm leading-none">{tr.passed ? '✓' : '✗'}</span> TC{tr.testCaseIndex}
              </motion.span>
            ))}
          </div>
        )}
      </div>

      <div className="bg-black/30 font-mono relative">
        <div className="flex items-center justify-between px-6 py-3 bg-black/40 border-b border-white/5">
          <div className="flex gap-2">
            <span className="w-3 h-3 rounded-full bg-red-400 dark:bg-red-500/40" />
            <span className="w-3 h-3 rounded-full bg-amber-400 dark:bg-yellow-500/40" />
            <span className="w-3 h-3 rounded-full bg-emerald-400 dark:bg-green-500/40" />
          </div>
          <span className="text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] ml-2 flex items-center gap-2">
            System Log — Test Case 1 {tc1 && <span className={`px-2 py-0.5 rounded-md ${tc1.status === 'Pass' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/20 text-red-600 dark:text-red-400'}`}>{tc1.executionStatus}</span>}
          </span>
          <div className="w-12" />
        </div>

        <div className="px-8 py-8 space-y-4">
          {hasCompErr && (
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500 block">Compiler Error Log</span>
              <pre className="text-red-400/90 text-xs leading-relaxed whitespace-pre-wrap break-all bg-red-500/5 p-4 rounded-2xl border border-red-500/10 max-h-60 overflow-y-auto custom-scrollbar">
                {compilationError}
              </pre>
            </div>
          )}

          {!hasCompErr && tc1 && (
            <div className="space-y-4">
              <TermLine label="Stdout" value={tc1.stdout ?? ''} accent={tc1.status === 'Pass' ? 'text-emerald-500' : 'text-slate-300'} />
              {tc1.status === 'Fail' && tc1.expectedOutput !== null && (
                <TermLine label="Expected" value={tc1.expectedOutput} accent="text-amber-500" />
              )}
              {tc1.stderr && (
                <div className="pt-2">
                  <TermLine label="Stderr" value={tc1.stderr} accent="text-red-500" />
                </div>
              )}
              {!tc1.stdout && !tc1.stderr && !tc1.compileOutput && (
                <span className="text-slate-600 text-xs italic opacity-50 block py-4">No output stream captured.</span>
              )}
            </div>
          )}

          {!hasCompErr && !tc1 && testResults.length > 0 && testResults[0].errorOutput && (
            <TermLine label="Runtime Stderr" value={testResults[0].errorOutput} accent="text-red-500" />
          )}

          {!hasCompErr && tc1?.status === 'Pass' && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 mt-4 text-emerald-500 text-[10px] font-black uppercase tracking-widest bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10">
              <span className="text-lg">✨</span> Verification logic matched expected outputs.
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

