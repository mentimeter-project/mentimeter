'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

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

  const liveCount = assessments.filter(a => a.is_active).length;
  const pendingReviews = assessments.reduce((sum, a) => sum + (a.pending_review || 0), 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-background animate-fade-in relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[5%] right-[10%] w-[30rem] h-[30rem] bg-indigo-500/5 dark:bg-indigo-500/10 blur-[120px] rounded-full animate-pulse-soft pointer-events-none" />
      <div className="absolute bottom-[10%] left-[5%] w-[40rem] h-[40rem] bg-purple-500/5 dark:bg-purple-500/10 blur-[120px] rounded-full animate-pulse-soft pointer-events-none" style={{ animationDelay: '2s' }} />

      {/* Nav */}
      <nav className="glass border-b border-gray-200 dark:border-white/5 px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <motion.div whileHover={{ rotate: 10 }} className="w-8 h-8 premium-gradient rounded-lg flex items-center justify-center shadow-md shadow-indigo-500/20">
            <span className="text-white font-black text-sm">M</span>
          </motion.div>
          <div className="flex flex-col">
            <span className="font-bold text-foreground leading-none">Mentimeter</span>
            <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-0.5">Admin Dashboard</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={toggleDark}
            className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-all border border-gray-200 dark:border-white/5"
            aria-label="Toggle dark mode">
            {dark ? '☀️' : '🌙'}
          </motion.button>
          <span className="text-muted-foreground text-xs hidden sm:block font-medium">👤 {adminName}</span>
          <Link href="/admin/create-assessment">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="premium-gradient text-white px-5 py-2 rounded-xl text-sm font-black transition-all shadow-lg shadow-indigo-500/25">
              + New Assessment
            </motion.button>
          </Link>
          <button onClick={logout} className="text-muted-foreground hover:text-red-500 text-xs font-black uppercase tracking-widest transition-colors ml-2">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-8 lg:p-12">
        {/* Hero greeting */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="text-3xl font-black text-foreground mb-2">{greeting}, {adminName}! 👋</h1>
          <p className="text-muted-foreground font-medium">
            {liveCount > 0 ? `You have ${liveCount} live assessment${liveCount > 1 ? 's' : ''} running.` : 'No assessments are live right now.'}
            {pendingReviews > 0 && <span className="text-amber-500 font-bold"> · {pendingReviews} response{pendingReviews > 1 ? 's' : ''} awaiting review.</span>}
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          {[
            { label: 'Assessments', value: assessments.length, color: 'text-indigo-600 dark:text-indigo-400', icon: '📋', border: 'border-indigo-500/10' },
            { label: 'Live Now', value: liveCount, color: 'text-emerald-600 dark:text-emerald-400', icon: '🟢', border: 'border-emerald-500/10' },
            { label: 'Total Students', value: 67, color: 'text-purple-600 dark:text-purple-400', icon: '👥', border: 'border-purple-500/10' },
            { label: 'Pending Review', value: pendingReviews, color: 'text-amber-600 dark:text-amber-400', icon: '⏳', border: 'border-amber-500/10' },
          ].map((s, idx) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className={`glass-premium rounded-2xl p-6 shadow-sm hover:-translate-y-1 hover:shadow-xl transition-all duration-300 border ${s.border}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest opacity-60">{s.label}</p>
                <span className="text-xl">{s.icon}</span>
              </div>
              <p className={`text-4xl font-black tabular-nums tracking-tighter ${s.color}`}>{s.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-foreground">All Assessments</h2>
          <span className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-50 px-3 py-1 bg-gray-100 dark:bg-white/5 rounded-full border border-gray-200 dark:border-white/5">Auto-refresh On</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
             <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : assessments.length === 0 ? (
          <div className="glass-premium border-2 border-dashed border-gray-200 dark:border-white/10 rounded-3xl p-16 text-center">
            <p className="text-5xl mb-6 shadow-sm">📝</p>
            <p className="text-muted-foreground font-black uppercase tracking-widest text-sm mb-4">No assessments found in database</p>
            <Link href="/admin/create-assessment">
               <motion.button whileHover={{ scale: 1.05 }} className="text-indigo-500 font-black text-sm hover:underline tracking-widest uppercase">
                  Create First Assessment →
               </motion.button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4 relative z-10">
            {assessments.map((a: any, idx) => (
              <motion.div key={a.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} className="glass-premium rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-center gap-6 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 border border-gray-100 dark:border-white/5">
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    {a.is_active ? (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Live
                      </span>
                    ) : (
                      <span className="bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-gray-200 dark:border-white/5">Draft</span>
                    )}
                    <h3 className="text-lg font-black text-foreground tracking-tight">{a.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-xs font-semibold uppercase tracking-widest opacity-60">
                    {a.question_count || 0} questions · {a.duration_minutes || 30} min · {a.response_count || 0} responses
                    {(a.pending_review || 0) > 0 && (
                      <span className="text-amber-500 font-black"> · {a.pending_review} pending review</span>
                    )}
                  </p>
                  {/* Mini progress bar */}
                  {a.response_count > 0 && (
                    <div className="mt-4 flex items-center gap-3">
                      <div className="w-48 h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-gray-200 dark:border-white/5">
                        <motion.div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                          initial={{ width: 0 }} animate={{ width: `${Math.min(100, ((a.response_count || 0) / 67) * 100)}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-muted-foreground uppercase">{a.response_count}/67 Submitted</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
                  <Link href={`/admin/monitor/${a.id}`} className="text-[10px] font-black px-4 py-2 rounded-xl border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-slate-800 text-foreground hover:bg-gray-100 dark:hover:bg-slate-700 transition-all uppercase tracking-widest shadow-sm hover:shadow-md">
                    👁 Monitor
                  </Link>
                  <Link href={`/admin/leaderboard/${a.id}`} className="text-[10px] font-black px-4 py-2 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30 transition-all uppercase tracking-widest shadow-sm hover:shadow-md">
                    🏆 Winners
                  </Link>
                  <Link href={`/admin/review/${a.id}`} className="text-[10px] font-black px-4 py-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/30 transition-all uppercase tracking-widest shadow-sm hover:shadow-md">
                    ✍ Review
                  </Link>
                  <motion.button whileHover={{ scale: 1.05 }} onClick={() => toggleActive(a.id, a.is_active)}
                    className={`text-[10px] font-black px-4 py-2 rounded-xl border transition-all uppercase tracking-widest shadow-sm ${
                      a.is_active
                        ? 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
                        : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                    }`}>
                    {a.is_active ? '⏹ Stop' : '▶ Start'}
                  </motion.button>

                  {!a.is_active && (
                    <motion.button whileHover={{ scale: 1.05 }} onClick={() => deleteAssessment(a.id, a.title)}
                      className="text-[10px] font-black px-4 py-2 rounded-xl border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-all uppercase tracking-widest">
                      🗑 Delete
                    </motion.button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
