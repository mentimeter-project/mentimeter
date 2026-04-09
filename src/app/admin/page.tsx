'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminDashboard() {
  const router = useRouter();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminName, setAdminName] = useState('Admin');
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.loggedIn || d.role !== 'admin') router.push('/');
      if (d.name) setAdminName(d.name);
    });
    fetchAssessments();
    const interval = setInterval(fetchAssessments, 10000);
    return () => clearInterval(interval);
  }, []);

  const toggleDark = () => {
    document.documentElement.classList.add('transitioning');
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    setDark(isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    setTimeout(() => document.documentElement.classList.remove('transitioning'), 350);
  };

  const fetchAssessments = async () => {
    const res = await fetch('/api/admin/assessments');
    const data = await res.json();
    setAssessments(data.assessments || []);
    setLoading(false);
  };

  const toggleActive = async (id: number, current: number) => {
    await fetch('/api/admin/toggle-assessment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId: id, isActive: current === 0 }),
    });
    fetchAssessments();
  };

  const deleteAssessment = async (id: number, title: string) => {
    if (!confirm(`Delete "${title}"?\n\nThis will permanently delete the assessment and all student responses. This cannot be undone.`)) return;

    const res = await fetch('/api/admin/delete-assessment', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId: id }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to delete');
      return;
    }
    fetchAssessments();
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const totalResponses = assessments.reduce((sum, a) => sum + (a.response_count || 0), 0);
  const liveCount = assessments.filter(a => a.is_active).length;
  const pendingReviews = assessments.reduce((sum, a) => sum + (a.pending_review || 0), 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 animate-fade-in">
      {/* Nav */}
      <nav className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-white/30 dark:border-slate-700/40 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-500/20">
            <span className="text-white font-black text-sm">M</span>
          </div>
          <div>
            <span className="font-bold text-slate-800 dark:text-white">Mentimeter</span>
            <span className="text-slate-400 dark:text-slate-500 text-xs ml-2">Admin Dashboard</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleDark}
            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm hover:scale-110 active:scale-95 transition-all border border-slate-200/50 dark:border-slate-600/50"
            aria-label="Toggle dark mode">
            {dark ? '☀️' : '🌙'}
          </button>
          <span className="text-slate-400 dark:text-slate-500 text-xs hidden sm:block">👤 {adminName}</span>
          <Link href="/admin/create-assessment"
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-95 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] shadow-lg shadow-indigo-500/25">
            + New Assessment
          </Link>
          <button onClick={logout} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm font-medium transition-colors">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-6">
        {/* Hero greeting */}
        <div className="mb-8 animate-slide-up">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{greeting}, {adminName}! 👋</h1>
          <p className="text-slate-400 dark:text-slate-500 text-sm">
            {liveCount > 0 ? `You have ${liveCount} live assessment${liveCount > 1 ? 's' : ''} running.` : 'No assessments are live right now.'}
            {pendingReviews > 0 && ` ${pendingReviews} response${pendingReviews > 1 ? 's' : ''} awaiting review.`}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Assessments', value: assessments.length, color: 'text-indigo-600 dark:text-indigo-400', icon: '📋', border: 'border-indigo-100 dark:border-indigo-800/50' },
            { label: 'Live Now', value: liveCount, color: 'text-emerald-600 dark:text-emerald-400', icon: '🟢', border: 'border-emerald-100 dark:border-emerald-800/50' },
            { label: 'Total Students', value: 67, color: 'text-violet-600 dark:text-violet-400', icon: '👥', border: 'border-violet-100 dark:border-violet-800/50' },
            { label: 'Pending Review', value: pendingReviews, color: 'text-amber-600 dark:text-amber-400', icon: '⏳', border: 'border-amber-100 dark:border-amber-800/50' },
          ].map(s => (
            <div key={s.label} className={`border ${s.border} bg-white/70 dark:bg-slate-800/50 backdrop-blur-lg rounded-2xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-300`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">{s.label}</p>
                <span className="text-lg">{s.icon}</span>
              </div>
              <p className={`text-3xl font-black tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">All Assessments</h2>
          <span className="text-xs text-slate-400 dark:text-slate-500">Auto-refreshes every 10s</span>
        </div>

        {loading && <p className="text-slate-400 dark:text-slate-500 text-sm">Loading...</p>}

        {!loading && assessments.length === 0 && (
          <div className="bg-white/50 dark:bg-slate-800/30 backdrop-blur-sm border-2 border-dashed border-slate-200/70 dark:border-slate-700/50 rounded-2xl p-12 text-center">
            <p className="text-4xl mb-3">📝</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mb-2">No assessments yet</p>
            <Link href="/admin/create-assessment" className="text-indigo-600 dark:text-indigo-400 text-sm font-semibold hover:underline">
              Create your first one →
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {assessments.map((a: any) => (
            <div key={a.id} className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-lg border border-white/30 dark:border-slate-700/40 rounded-2xl p-5 flex flex-col sm:flex-row justify-between gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {a.is_active ? (
                    <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/50 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Live
                    </span>
                  ) : (
                    <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2.5 py-0.5 rounded-full text-xs font-medium">Draft</span>
                  )}
                  <h3 className="font-semibold text-slate-800 dark:text-white">{a.title}</h3>
                </div>
                <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                  {a.question_count || 0} questions · {a.duration_minutes || 30} min · {a.response_count || 0} responses
                  {(a.pending_review || 0) > 0 && (
                    <span className="text-amber-500 dark:text-amber-400 font-semibold"> · {a.pending_review} pending review</span>
                  )}
                </p>
                {/* Mini progress bar */}
                {a.response_count > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="w-32 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, ((a.response_count || 0) / 67) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{a.response_count}/67</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link href={`/admin/monitor/${a.id}`}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">
                  👁 Monitor
                </Link>
                <Link href={`/admin/leaderboard/${a.id}`}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
                  🏆 Leaderboard
                </Link>
                <Link href={`/admin/review/${a.id}`}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-700/50 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                  ✍ Review
                </Link>
                <button onClick={() => toggleActive(a.id, a.is_active)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
                    a.is_active
                      ? 'border-red-200 dark:border-red-700/50 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40'
                      : 'border-emerald-200 dark:border-emerald-700/50 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                  }`}>
                  {a.is_active ? '⏹ Stop' : '▶ Go Live'}
                </button>
                {!a.is_active && (
                  <button onClick={() => deleteAssessment(a.id, a.title)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-700/50 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                    🗑 Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
