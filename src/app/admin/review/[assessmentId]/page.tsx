'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ReviewPage() {
  const router = useRouter();
  const params = useParams();
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [awarding, setAwarding] = useState<number | null>(null);
  const [marksInput, setMarksInput] = useState<Record<number, string>>({});

  const fetchResults = useCallback(async () => {
    const res = await fetch(`/api/admin/responses/${params.assessmentId}`);
    const data = await res.json();
    setResults(data.results || []);
    setLoading(false);
  }, [params.assessmentId]);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.loggedIn || d.role !== 'admin') router.push('/');
    });
    fetchResults();
  }, [router, fetchResults]);

  const awardMarks = async (responseId: number, maxMarks: number) => {
    const marks = parseInt(marksInput[responseId] || '0');
    if (isNaN(marks) || marks < 0 || marks > maxMarks) return;
    setAwarding(responseId);
    await fetch('/api/admin/award-marks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responseId, marks }),
    });
    setAwarding(null);
    fetchResults();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 animate-fade-in">
      <nav className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-white/30 dark:border-slate-700/40 px-6 py-4 flex justify-between items-center shadow-sm">
        <span className="font-bold text-slate-800 dark:text-white">✍ Review Answers</span>
        <Link href="/admin" className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm font-medium transition-colors">← Dashboard</Link>
      </nav>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {loading && <p className="text-slate-400 dark:text-slate-500 text-sm">Loading responses...</p>}

        {!loading && results.length === 0 && (
          <div className="text-center py-20 animate-slide-up">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm">No responses to review yet.</p>
          </div>
        )}

        {results.map((q) => (
          <div key={q.id as number} className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-lg border border-white/30 dark:border-slate-700/40 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-800/30">
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider mb-0.5">Question · {q.max_marks as number} marks</p>
              <p className="text-slate-800 dark:text-white font-semibold">{q.question_text as string}</p>
            </div>

            {(q.responses as Record<string, unknown>[]).length === 0 && (
              <p className="px-6 py-4 text-slate-400 dark:text-slate-500 text-sm">No responses yet.</p>
            )}

            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {(q.responses as Record<string, unknown>[]).map((r) => (
                <div key={r.id as number} className="px-6 py-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{r.student_name as string}</span>
                        <span className="text-slate-400 dark:text-slate-500 text-xs font-mono">{r.usn as string}</span>
                        {r.reviewed ? (
                          <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/50 text-xs font-semibold px-2 py-0.5 rounded-full">
                            {r.marks_awarded as number}/{q.max_marks as number} marks
                          </span>
                        ) : (
                          <span className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700/50 text-xs font-semibold px-2 py-0.5 rounded-full">
                            Pending review
                          </span>
                        )}
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl px-4 py-3 text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap">
                        {(r.answer_text as string) || <span className="text-slate-300 dark:text-slate-600 italic">No answer submitted</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        type="number" min={0} max={q.max_marks as number}
                        placeholder={`0–${q.max_marks as number}`}
                        value={marksInput[r.id as number] ?? (r.reviewed ? r.marks_awarded as number : '')}
                        onChange={e => setMarksInput(prev => ({ ...prev, [r.id as number]: e.target.value }))}
                        className="w-20 bg-white/50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-slate-800 dark:text-white text-sm text-center focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all"
                      />
                      <button
                        onClick={() => awardMarks(r.id as number, q.max_marks as number)}
                        disabled={awarding === (r.id as number)}
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-95 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50 hover:scale-[1.02]">
                        {awarding === (r.id as number) ? '...' : 'Award'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
