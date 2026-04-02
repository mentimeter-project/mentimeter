'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminDashboard() {
  const router = useRouter();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminName, setAdminName] = useState('Admin');

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.loggedIn || d.role !== 'admin') router.push('/');
      if (d.name) setAdminName(d.name);
    });
    fetchAssessments();
    const interval = setInterval(fetchAssessments, 10000);
    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-sm">M</span>
          </div>
          <div>
            <span className="font-bold text-slate-800">Mentimeter</span>
            <span className="text-slate-400 text-xs ml-2">Admin Dashboard</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-xs hidden sm:block">👤 {adminName}</span>
          <Link href="/admin/create-assessment"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm">
            + New Assessment
          </Link>
          <button onClick={logout} className="text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Assessments', value: assessments.length, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
            { label: 'Live Now', value: liveCount, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label: 'Total Students', value: 67, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
            { label: 'Pending Review', value: pendingReviews, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          ].map(s => (
            <div key={s.label} className={`bg-white border ${s.border} rounded-2xl p-5 shadow-sm`}>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-700">All Assessments</h2>
          <span className="text-xs text-slate-400">Auto-refreshes every 10s</span>
        </div>

        {loading && <p className="text-slate-400 text-sm">Loading...</p>}

        {!loading && assessments.length === 0 && (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
            <p className="text-slate-400 text-sm mb-2">No assessments yet</p>
            <Link href="/admin/create-assessment" className="text-indigo-600 text-sm font-semibold hover:underline">
              Create your first one →
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {assessments.map((a: any) => (
            <div key={a.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {a.is_active ? (
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Live
                    </span>
                  ) : (
                    <span className="bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full text-xs font-medium">Draft</span>
                  )}
                  <h3 className="font-semibold text-slate-800">{a.title}</h3>
                </div>
                <p className="text-slate-400 text-xs mt-1">
                  {a.question_count || 0} questions · {a.duration_minutes || 30} min · {a.response_count || 0} responses
                  {(a.pending_review || 0) > 0 && (
                    <span className="text-amber-500 font-semibold"> · {a.pending_review} pending review</span>
                  )}
                </p>
                {/* Mini progress bar */}
                {a.response_count > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, ((a.response_count || 0) / 67) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-slate-400">{a.response_count}/67</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link href={`/admin/monitor/${a.id}`}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors">
                  👁 Monitor
                </Link>
                <Link href={`/admin/leaderboard/${a.id}`}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                  🏆 Leaderboard
                </Link>
                <Link href={`/admin/review/${a.id}`}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors">
                  ✍ Review
                </Link>
                <button onClick={() => toggleActive(a.id, a.is_active)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
                    a.is_active
                      ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}>
                  {a.is_active ? '⏹ Stop' : '▶ Go Live'}
                </button>
                {!a.is_active && (
                  <button onClick={() => deleteAssessment(a.id, a.title)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
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
