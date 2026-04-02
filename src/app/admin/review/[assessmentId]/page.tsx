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
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <span className="font-bold text-slate-800">✍ Review Answers</span>
        <Link href="/admin" className="text-slate-400 hover:text-slate-600 text-sm font-medium">← Dashboard</Link>
      </nav>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {loading && <p className="text-slate-400 text-sm">Loading responses...</p>}

        {results.map((q) => (
          <div key={q.id as number} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wider mb-0.5">Question · {q.max_marks as number} marks</p>
              <p className="text-slate-800 font-semibold">{q.question_text as string}</p>
            </div>

            {(q.responses as Record<string, unknown>[]).length === 0 && (
              <p className="px-6 py-4 text-slate-400 text-sm">No responses yet.</p>
            )}

            <div className="divide-y divide-slate-100">
              {(q.responses as Record<string, unknown>[]).map((r) => (
                <div key={r.id as number} className="px-6 py-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-slate-700 text-sm">{r.student_name as string}</span>
                        <span className="text-slate-400 text-xs font-mono">{r.usn as string}</span>
                        {r.reviewed ? (
                          <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-semibold px-2 py-0.5 rounded-full">
                            {r.marks_awarded as number}/{q.max_marks as number} marks
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-600 border border-amber-200 text-xs font-semibold px-2 py-0.5 rounded-full">
                            Pending review
                          </span>
                        )}
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 text-sm whitespace-pre-wrap">
                        {(r.answer_text as string) || <span className="text-slate-300 italic">No answer submitted</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        type="number" min={0} max={q.max_marks as number}
                        placeholder={`0–${q.max_marks as number}`}
                        value={marksInput[r.id as number] ?? (r.reviewed ? r.marks_awarded as number : '')}
                        onChange={e => setMarksInput(prev => ({ ...prev, [r.id as number]: e.target.value }))}
                        className="w-20 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm text-center focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                      <button
                        onClick={() => awardMarks(r.id as number, q.max_marks as number)}
                        disabled={awarding === (r.id as number)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50">
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
