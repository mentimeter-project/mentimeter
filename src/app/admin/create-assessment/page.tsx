'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const emptyQ = () => ({ question_text: '', max_marks: 10 });

export default function CreateAssessmentPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(30);
  const [questions, setQuestions] = useState([emptyQ()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const updateQ = (i: number, field: string, value: string | number) =>
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q));

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    if (questions.some(q => !q.question_text.trim())) { setError('All questions must have text'); return; }
    setSubmitting(true);
    const res = await fetch('/api/admin/create-assessment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, duration_minutes: duration, questions }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSubmitting(false); return; }
    router.push('/admin');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-sm">M</span>
          </div>
          <span className="font-bold text-slate-800">Create Assessment</span>
        </div>
        <Link href="/admin" className="text-slate-400 hover:text-slate-600 text-sm font-medium">← Back</Link>
      </nav>

      <div className="max-w-3xl mx-auto p-6 space-y-4">
        {/* Details Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wider">Assessment Details</h2>
          <input
            placeholder="Assessment title" value={title} onChange={e => setTitle(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm placeholder-slate-300 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
          <textarea
            placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} rows={2}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm placeholder-slate-300 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
          />
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-500 font-medium">Duration (minutes):</label>
            <input
              type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value))} min={5} max={180}
              className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {/* Questions */}
        {questions.map((q, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-indigo-600 text-xs font-bold uppercase tracking-wider">Question {i + 1}</span>
              {questions.length > 1 && (
                <button onClick={() => setQuestions(p => p.filter((_, idx) => idx !== i))}
                  className="text-red-400 hover:text-red-600 text-xs font-medium transition-colors">
                  Remove
                </button>
              )}
            </div>
            <textarea
              placeholder="Write your question here..." value={q.question_text}
              onChange={e => updateQ(i, 'question_text', e.target.value)} rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm placeholder-slate-300 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
            />
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-500 font-medium">Max Marks:</label>
              <input
                type="number" value={q.max_marks} onChange={e => updateQ(i, 'max_marks', parseInt(e.target.value))} min={1} max={100}
                className="w-20 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
        ))}

        <button
          onClick={() => setQuestions(p => [...p, emptyQ()])}
          className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-400 text-slate-400 hover:text-indigo-600 rounded-2xl py-4 text-sm font-semibold transition-all">
          + Add Question
        </button>

        {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}

        <button onClick={handleSubmit} disabled={submitting}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-2xl transition-colors shadow-md shadow-indigo-200 disabled:opacity-50">
          {submitting ? 'Creating...' : 'Create Assessment'}
        </button>
      </div>
    </div>
  );
}
