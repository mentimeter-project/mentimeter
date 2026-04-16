'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ──────────────────────────────────────────────────────────────────
interface TestCase {
  input: string;
  expected_output: string;
  marks: number;
}

interface Question {
  question_text: string;
  question_type: 'text' | 'code';
  code_mode: 'stdin' | 'function';
  function_name: string;
  max_marks: number;
  test_cases: TestCase[];
}

const emptyTestCase = (): TestCase => ({ input: '', expected_output: '', marks: 1 });
const emptyQ = (): Question => ({
  question_text: '',
  question_type: 'text',
  code_mode: 'stdin',
  function_name: '',
  max_marks: 10,
  test_cases: [],
});

// ── Component ──────────────────────────────────────────────────────────────
export default function CreateAssessmentPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(30);
  const [questions, setQuestions] = useState<Question[]>([emptyQ()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // ── Question helpers ─────────────────────────────────────────────────────
  const updateQ = (i: number, field: keyof Question, value: string | number) =>
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q));

  const setQType = (i: number, type: 'text' | 'code') =>
    setQuestions(prev => prev.map((q, idx) =>
      idx === i ? { ...q, question_type: type, code_mode: type === 'code' ? q.code_mode : 'stdin', function_name: type === 'code' ? q.function_name : '', test_cases: type === 'code' && q.test_cases.length === 0 ? [emptyTestCase()] : q.test_cases } : q
    ));

  const setCodeMode = (i: number, mode: 'stdin' | 'function') =>
    setQuestions(prev => prev.map((q, idx) =>
      idx === i ? { ...q, code_mode: mode, function_name: mode === 'function' ? q.function_name : '' } : q
    ));

  const addTestCase = (qIdx: number) =>
    setQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, test_cases: [...q.test_cases, emptyTestCase()] } : q));

  const removeTestCase = (qIdx: number, tcIdx: number) =>
    setQuestions(prev => prev.map((q, i) => i === qIdx
      ? { ...q, test_cases: q.test_cases.filter((_, ti) => ti !== tcIdx) }
      : q
    ));

  const updateTestCase = (qIdx: number, tcIdx: number, field: keyof TestCase, value: string | number) =>
    setQuestions(prev => prev.map((q, i) => i === qIdx
      ? {
          ...q,
          test_cases: q.test_cases.map((tc, ti) => ti === tcIdx ? { ...tc, [field]: value } : tc),
        }
      : q
    ));

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    if (questions.some(q => !q.question_text.trim())) { setError('All questions must have text'); return; }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.question_type === 'code') {
        if (q.code_mode === 'function') {
          if (!q.function_name.trim()) {
            setError(`Question ${i + 1} is function-based but has no function name`); return;
          }
          let fn = q.function_name.trim().replace(/^(def|function)\s+/, '').replace(/\s*\(.*$/, '').trim();
          const VALID_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
          if (!VALID_IDENTIFIER.test(fn)) {
            setError(`Question ${i + 1}: "${fn}" is not a valid identifier.`); return;
          }
          if (fn !== q.function_name.trim()) {
            setQuestions(prev => prev.map((qq, idx) => idx === i ? { ...qq, function_name: fn } : qq));
          }
        }
        if (q.test_cases.length === 0) {
          setError(`Question ${i + 1} is a coding question but has no test cases`); return;
        }
        if (q.test_cases.some(tc => !tc.expected_output.trim())) {
          setError(`Question ${i + 1}: all test cases must have an expected output`); return;
        }
      }
    }
    setSubmitting(true);
    setError('');
    const res = await fetch('/api/admin/create-assessment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, duration_minutes: duration, questions }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Failed to create assessment'); setSubmitting(false); return; }
    router.push('/admin');
  };

  const inputClass = 'w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-foreground text-sm placeholder-muted-foreground/40 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner';
  const labelClass = 'text-xs font-black uppercase tracking-widest text-muted-foreground opacity-60 mb-2 block';

  return (
    <div className="min-h-screen bg-background animate-fade-in relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[-5%] right-[-5%] w-[40rem] h-[40rem] bg-indigo-500/5 dark:bg-indigo-500/10 blur-[130px] rounded-full animate-pulse-soft pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[45rem] h-[45rem] bg-purple-500/5 dark:bg-purple-500/10 blur-[130px] rounded-full animate-pulse-soft pointer-events-none" style={{ animationDelay: '3s' }} />

      {/* Nav */}
      <nav className="glass border-b border-gray-200 dark:border-white/5 px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <motion.div whileHover={{ rotate: 10 }} className="w-8 h-8 premium-gradient rounded-lg flex items-center justify-center shadow-md shadow-indigo-500/20">
            <span className="text-white font-black text-sm">M</span>
          </motion.div>
          <span className="font-black text-foreground text-base tracking-tight italic">Create Assessment</span>
        </div>
        <Link href="/admin">
          <motion.button whileHover={{ x: -2 }} className="text-muted-foreground hover:text-foreground text-[10px] font-black uppercase tracking-widest transition-colors">← Back to Dashboard</motion.button>
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto p-12 space-y-6">
        <header className="mb-4">
           <h2 className="text-4xl font-black text-foreground italic tracking-tight mb-2">New Assessment</h2>
           <p className="text-muted-foreground font-medium uppercase tracking-[0.2em] text-[10px]">Set up your test details.</p>
        </header>

        {/* Assessment Details */}
        <section className="glass-premium border border-gray-100 dark:border-white/5 rounded-3xl p-8 shadow-sm space-y-6">
          <div>
            <label className={labelClass}>Assessment Title</label>
            <input
              placeholder="e.g. Advanced System Architecture" value={title} onChange={e => setTitle(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              placeholder="Technical description of assessment goals..." value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col gap-1.5">
               <label className={labelClass}>Duration (Min)</label>
               <input
                 type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 30)} min={5} max={300}
                 className="w-24 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/5 rounded-xl px-4 py-2 text-foreground font-black text-xs focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
               />
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500/60 leading-tight">Give students enough time to finish.</p>
          </div>
        </section>

        {/* Questions */}
        <div className="space-y-6">
          <AnimatePresence>
            {questions.map((q, i) => (
              <motion.section 
                key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className="glass-premium border border-gray-100 dark:border-white/5 rounded-3xl p-8 shadow-sm space-y-6 relative group"
              >
                {/* Question header */}
                <div className="flex justify-between items-center">
                  <span className="text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em]">Question {String(i + 1).padStart(2, '0')}</span>
                  {questions.length > 1 && (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setQuestions(p => p.filter((_, idx) => idx !== i))}
                      className="text-red-500 hover:text-red-400 text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 group-hover:opacity-100 opacity-60">
                      Delete Question 🗑️
                    </motion.button>
                  )}
                </div>

                {/* Question text */}
                <div>
                   <label className={labelClass}>Question Text</label>
                   <textarea
                    placeholder="Enter question description..." value={q.question_text}
                    onChange={e => updateQ(i, 'question_text', e.target.value)} rows={3}
                    className={`${inputClass} resize-none py-4 leading-relaxed font-medium`}
                  />
                </div>

                {/* Type selector + max marks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>Answer Type</label>
                    <div className="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-white/5">
                      <button
                        onClick={() => setQType(i, 'text')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                          q.question_type === 'text'
                            ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400'
                            : 'text-muted-foreground'
                        }`}
                      >
                        📝 Text
                      </button>
                      <button
                        onClick={() => setQType(i, 'code')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                          q.question_type === 'code'
                            ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400'
                            : 'text-muted-foreground'
                        }`}
                      >
                        💻 Code
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className={labelClass}>Points</label>
                    <input
                      type="number" value={q.max_marks}
                      onChange={e => updateQ(i, 'max_marks', parseInt(e.target.value) || 10)} min={1} max={100}
                      className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/5 rounded-xl px-4 py-2 text-foreground font-black text-xs focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Code Extras */}
                {q.question_type === 'code' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-6 pt-6 border-t border-gray-100 dark:border-white/5">
                    <div className="space-y-4">
                      <label className={labelClass}>Code Environment</label>
                      <div className="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-white/5">
                        <button
                          onClick={() => setCodeMode(i, 'stdin')}
                          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                            q.code_mode === 'stdin'
                              ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400'
                              : 'text-muted-foreground'
                          }`}
                        >
                          📦 Standard Input/Output
                        </button>
                        <button
                          onClick={() => setCodeMode(i, 'function')}
                          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                            q.code_mode === 'function'
                              ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400'
                              : 'text-muted-foreground'
                          }`}
                        >
                          ⚡ Function
                        </button>
                      </div>
                    </div>

                    {q.code_mode === 'function' && (
                      <div className="space-y-2">
                        <label className={labelClass}>Function Name</label>
                        <input
                          type="text" value={q.function_name} onChange={e => updateQ(i, 'function_name', e.target.value)}
                          placeholder="e.g. solve"
                          className={`${inputClass} font-mono`}
                        />
                      </div>
                    )}

                    {/* Test Cases */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <label className={labelClass}>Hidden Test Cases</label>
                         <span className="text-[10px] font-medium text-muted-foreground opacity-50 px-2 py-0.5 rounded-lg border border-gray-200 dark:border-white/5">{q.test_cases.length} test cases</span>
                      </div>

                      <div className="space-y-3">
                        {q.test_cases.map((tc, ti) => (
                          <div key={ti} className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-white/5 rounded-2xl p-6 space-y-4 relative shadow-inner group/probe">
                            <div className="flex items-center justify-between">
                              <span className="text-indigo-500 text-[10px] font-black uppercase tracking-widest">Test Case {ti + 1}</span>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <label className="text-[9px] font-black text-muted-foreground uppercase">Points</label>
                                  <input
                                    type="number" value={tc.marks} min={1} max={50}
                                    onChange={e => updateTestCase(i, ti, 'marks', parseInt(e.target.value) || 1)}
                                    className="w-14 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/5 rounded-lg px-2 py-1 text-foreground text-xs font-black shadow-sm"
                                  />
                                </div>
                                {q.test_cases.length > 1 && (
                                  <button onClick={() => removeTestCase(i, ti)}
                                    className="text-red-500/60 hover:text-red-500 p-1.5 hover:bg-red-500/10 rounded-lg transition-all">
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Input</label>
                                <textarea
                                  value={tc.input} onChange={e => updateTestCase(i, ti, 'input', e.target.value)} rows={2}
                                  placeholder="(Blank if default)"
                                  className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/5 rounded-xl px-4 py-3 text-xs font-mono text-foreground focus:ring-1 focus:ring-indigo-500 outline-none resize-none shadow-sm"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest opacity-40">Expected Output</label>
                                <textarea
                                  value={tc.expected_output} onChange={e => updateTestCase(i, ti, 'expected_output', e.target.value)} rows={2}
                                  placeholder="Expected output..."
                                  className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/5 rounded-xl px-4 py-3 text-xs font-mono text-foreground focus:ring-1 focus:ring-indigo-500 outline-none resize-none shadow-sm"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => addTestCase(i)}
                        className="w-full border-2 border-dashed border-gray-200 dark:border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/5 text-muted-foreground hover:text-indigo-500 rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest transition-all">
                        + Add Test Case
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </motion.section>
            ))}
          </AnimatePresence>
        </div>

        <div className="space-y-8 pt-8 border-t border-gray-100 dark:border-white/5">
           <motion.button
             whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
             onClick={() => setQuestions(p => [...p, emptyQ()])}
             className="w-full p-8 rounded-[2rem] border-2 border-dashed border-gray-200 dark:border-white/10 hover:border-indigo-500/50 transition-all flex flex-col items-center justify-center gap-3 group"
           >
              <span className="text-2xl group-hover:scale-125 transition-transform duration-300">🏢</span>
              <span className="text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground group-hover:text-indigo-500">Add Question</span>
           </motion.button>

           {error && (
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-red-500/5 border border-red-500/20 text-red-500 text-[10px] font-black px-8 py-5 rounded-2xl uppercase tracking-widest shadow-2xl">
                ⚠️ Error: {error}
             </motion.div>
           )}

           <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSubmit} disabled={submitting}
             className="w-full premium-gradient text-white font-black py-6 rounded-[2rem] transition-all shadow-2xl shadow-indigo-500/30 disabled:opacity-50 uppercase tracking-[0.3em] text-[12px] flex items-center justify-center gap-4">
             {submitting ? 'Creating...' : 'Create Assessment 🚀'}
           </motion.button>
        </div>
      </div>
    </div>
  );
}
