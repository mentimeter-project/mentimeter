'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export default function ReviewPage() {
  const router = useRouter();
  const params = useParams();
  const [results, setResults] = useState<any[]>([]);
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
    const val = marksInput[responseId];
    if (val === undefined || val === '') return;
    const marks = parseInt(val);
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
    <div className="min-h-screen bg-background animate-fade-in relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[5%] right-[10%] w-[35rem] h-[35rem] bg-indigo-500/5 dark:bg-indigo-500/10 blur-[130px] rounded-full animate-pulse-soft pointer-events-none" />
      <div className="absolute bottom-[10%] left-[5%] w-[45rem] h-[45rem] bg-purple-500/5 dark:bg-purple-500/10 blur-[130px] rounded-full animate-pulse-soft pointer-events-none" style={{ animationDelay: '3s' }} />

      <nav className="glass border-b border-gray-200 dark:border-white/5 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-purple-500/10 rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-purple-500/10 border border-purple-500/20">✍️</div>
          <div>
            <span className="font-black text-foreground text-lg tracking-tight">Manual Oversight</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-amber-500 text-[10px] font-black uppercase tracking-widest">Grading Protocol Active</span>
            </div>
          </div>
        </div>
        <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm font-bold transition-all bg-gray-100 dark:bg-white/5 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/5">← Dashboard</Link>
      </nav>

      <div className="max-w-4xl mx-auto p-8 lg:p-12 space-y-8 animate-slide-up">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-12 h-12 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin mb-4 shadow-xl shadow-indigo-500/10" />
            <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest leading-none">Accessing Response Modules...</p>
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="text-center py-24 glass-premium border-2 border-dashed border-gray-200 dark:border-white/10 rounded-[3rem] shadow-2xl">
            <p className="text-5xl mb-6 shadow-sm">📭</p>
            <p className="text-muted-foreground font-black uppercase tracking-widest text-xs opacity-60">No student submissions available for review.</p>
          </div>
        )}

        {results.map((q, idx) => (
          <motion.div key={q.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="glass-premium border border-gray-100 dark:border-white/5 rounded-[3rem] shadow-2xl overflow-hidden group">
            <div className="px-10 py-8 border-b border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
              <div className="flex items-center gap-3 mb-3">
                 <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-lg">Question Cluster</span>
                 <span className="text-[10px] font-black text-muted-foreground uppercase opacity-40">Allocated Weights: {q.max_marks} Pts</span>
              </div>
              <p className="text-foreground font-black text-xl leading-relaxed italic tracking-tight">{q.question_text}</p>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {q.responses.length === 0 ? (
                <div className="px-10 py-12 text-center">
                   <p className="text-muted-foreground text-xs font-black uppercase tracking-widest opacity-40 italic">Waiting for incoming signals...</p>
                </div>
              ) : (
                q.responses.map((r: any) => (
                  <div key={r.id} className="px-10 py-10 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors relative group/row">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-10">
                      <div className="flex-1 w-full relative z-10">
                        <div className="flex items-center gap-4 mb-4 flex-wrap">
                          <span className="font-black text-foreground text-lg tracking-tight italic">{r.student_name}</span>
                          <span className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-2.5 py-1 rounded-lg opacity-60">{r.usn}</span>
                          <div className="flex-grow md:flex-grow-0" />
                          <AnimatePresence mode="wait">
                            {r.reviewed ? (
                              <motion.span initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-[0.25em] px-4 py-1.5 rounded-xl shadow-inner">
                                VALIDATED: {r.marks_awarded} / {q.max_marks} PTS
                              </motion.span>
                            ) : (
                              <motion.span initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[9px] font-black uppercase tracking-[0.25em] px-4 py-1.5 rounded-xl animate-pulse">
                                AWAITING AUDIT
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                        <div className="bg-white dark:bg-black/30 border border-gray-100 dark:border-white/5 rounded-3xl px-8 py-6 text-foreground text-sm whitespace-pre-wrap leading-relaxed shadow-inner opacity-90 group-hover/row:opacity-100 transition-opacity">
                          {r.answer_text || <span className="text-muted-foreground italic opacity-40">Module Input Null</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0 pt-10 md:pt-14 w-full md:w-auto">
                        <div className="relative flex-1 md:flex-none">
                           <input
                            type="number" min={0} max={q.max_marks}
                            placeholder={`Max ${q.max_marks}`}
                            value={marksInput[r.id] ?? (r.reviewed ? r.marks_awarded : '')}
                            onChange={e => setMarksInput(prev => ({ ...prev, [r.id]: e.target.value }))}
                            className="w-full md:w-28 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-3.5 text-foreground text-sm text-center focus:ring-4 focus:ring-indigo-500/10 transition-all font-black shadow-inner outline-none"
                          />
                          <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-black text-muted-foreground uppercase opacity-40">Marks</span>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05, filter: 'brightness(1.1)' }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => awardMarks(r.id, q.max_marks)}
                          disabled={awarding === r.id}
                          className="flex-1 md:flex-none premium-gradient text-white text-[10px] font-black uppercase tracking-widest px-8 py-4 rounded-2xl transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50">
                          {awarding === r.id ? 'SYNK...' : 'DEPLOY'}
                        </motion.button>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
