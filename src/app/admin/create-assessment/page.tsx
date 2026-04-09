'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────────────────
interface TestCase {
  input: string;
  expected_output: string;
  marks: number;
}

interface Question {
  question_text: string;
  question_type: 'text' | 'code';
  max_marks: number;
  test_cases: TestCase[];
}

const emptyTestCase = (): TestCase => ({ input: '', expected_output: '', marks: 1 });
const emptyQ = (): Question => ({
  question_text: '',
  question_type: 'text',
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
      idx === i ? { ...q, question_type: type, test_cases: type === 'code' && q.test_cases.length === 0 ? [emptyTestCase()] : q.test_cases } : q
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
    // Validate coding questions have at least one test case with expected output
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.question_type === 'code') {
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

  const inputClass = 'w-full bg-white/50 dark:bg-slate-700/50 border border-slate-200/60 dark:border-slate-600/40 rounded-xl px-4 py-2.5 text-slate-800 dark:text-white text-sm placeholder-slate-300 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all';
  const tcInputClass = 'flex-1 bg-slate-800 dark:bg-slate-900 border border-slate-700 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 animate-fade-in">
      {/* Nav */}
      <nav className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-white/30 dark:border-slate-700/40 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-500/20">
            <span className="text-white font-black text-sm">M</span>
          </div>
          <span className="font-bold text-slate-800 dark:text-white">Create Assessment</span>
        </div>
        <Link href="/admin" className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm font-medium transition-colors">← Back</Link>
      </nav>

      <div className="max-w-3xl mx-auto p-6 space-y-4">
        {/* Assessment Details */}
        <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-lg border border-white/30 dark:border-slate-700/40 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wider">Assessment Details</h2>
          <input
            id="assessment-title"
            placeholder="Assessment title" value={title} onChange={e => setTitle(e.target.value)}
            className={inputClass}
          />
          <textarea
            placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} rows={2}
            className={`${inputClass} resize-none`}
          />
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-500 dark:text-slate-400 font-medium">Duration (minutes):</label>
            <input
              type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value))} min={5} max={180}
              className="w-24 bg-white/50 dark:bg-slate-700/50 border border-slate-200/60 dark:border-slate-600/40 rounded-xl px-3 py-2 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all"
            />
          </div>
        </div>

        {/* Questions */}
        {questions.map((q, i) => (
          <div key={i} className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-lg border border-white/30 dark:border-slate-700/40 rounded-2xl p-6 shadow-sm space-y-4">
            {/* Question header */}
            <div className="flex justify-between items-center">
              <span className="text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">Question {i + 1}</span>
              {questions.length > 1 && (
                <button onClick={() => setQuestions(p => p.filter((_, idx) => idx !== i))}
                  className="text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400 text-xs font-medium transition-colors">
                  Remove
                </button>
              )}
            </div>

            {/* Question text */}
            <textarea
              placeholder="Write your question here..." value={q.question_text}
              onChange={e => updateQ(i, 'question_text', e.target.value)} rows={3}
              className={`${inputClass} resize-none`}
            />

            {/* Type selector + max marks */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Question type toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Type:</span>
                <div className="flex rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                  <button
                    onClick={() => setQType(i, 'text')}
                    className={`px-4 py-1.5 text-xs font-semibold transition-all ${
                      q.question_type === 'text'
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    📝 Text Answer
                  </button>
                  <button
                    onClick={() => setQType(i, 'code')}
                    className={`px-4 py-1.5 text-xs font-semibold transition-all border-l border-slate-200 dark:border-slate-600 ${
                      q.question_type === 'code'
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    💻 Coding
                  </button>
                </div>
              </div>

              {/* Max marks */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-500 dark:text-slate-400 font-medium">Max Marks:</label>
                <input
                  type="number" value={q.max_marks}
                  onChange={e => updateQ(i, 'max_marks', parseInt(e.target.value))} min={1} max={100}
                  className="w-20 bg-white/50 dark:bg-slate-700/50 border border-slate-200/60 dark:border-slate-600/40 rounded-xl px-3 py-1.5 text-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all"
                />
              </div>
            </div>

            {/* Test Cases (coding questions only) */}
            {q.question_type === 'code' && (
              <div className="bg-slate-900 dark:bg-slate-950 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                    🧪 Hidden Test Cases
                    <span className="text-slate-500 font-normal ml-2">(students cannot see these)</span>
                  </p>
                  <span className="text-slate-500 text-xs">{q.test_cases.length} case{q.test_cases.length !== 1 ? 's' : ''}</span>
                </div>

                {q.test_cases.length === 0 && (
                  <p className="text-slate-500 text-xs text-center py-3">
                    Add at least one test case to evaluate student code.
                  </p>
                )}

                {q.test_cases.map((tc, ti) => (
                  <div key={ti} className="bg-slate-800 dark:bg-slate-900/80 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-indigo-400 text-xs font-semibold">Test Case {ti + 1}</span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <label className="text-slate-400 text-xs">Marks:</label>
                          <input
                            type="number" value={tc.marks} min={1} max={50}
                            onChange={e => updateTestCase(i, ti, 'marks', parseInt(e.target.value) || 1)}
                            className="w-14 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        {q.test_cases.length > 1 && (
                          <button onClick={() => removeTestCase(i, ti)}
                            className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors">
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-500 text-xs block mb-1">stdin (input)</label>
                        <textarea
                          value={tc.input}
                          onChange={e => updateTestCase(i, ti, 'input', e.target.value)}
                          rows={2}
                          placeholder="(leave empty if no input)"
                          className={`${tcInputClass} w-full resize-none`}
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 text-xs block mb-1">stdout (expected output) *</label>
                        <textarea
                          value={tc.expected_output}
                          onChange={e => updateTestCase(i, ti, 'expected_output', e.target.value)}
                          rows={2}
                          placeholder="Expected output..."
                          className={`${tcInputClass} w-full resize-none`}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => addTestCase(i)}
                  className="w-full border border-dashed border-slate-600 hover:border-indigo-500 text-slate-500 hover:text-indigo-400 rounded-lg py-2 text-xs font-medium transition-all"
                >
                  + Add Test Case
                </button>
              </div>
            )}
          </div>
        ))}

        <button
          onClick={() => setQuestions(p => [...p, emptyQ()])}
          className="w-full border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl py-4 text-sm font-semibold transition-all">
          + Add Question
        </button>

        {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800/50 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl">{error}</div>}

        <button onClick={handleSubmit} disabled={submitting}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.98] text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 hover:scale-[1.01]">
          {submitting ? 'Creating...' : 'Create Assessment'}
        </button>
      </div>
    </div>
  );
}
