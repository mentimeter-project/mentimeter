'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export default function MonitorPage() {
  const params = useParams();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'suspicious'>('all');

  const fetchData = () => {
    fetch(`/api/admin/monitor/${params.assessmentId}`)
      .then(r => r.json())
      .then(d => { setStudents(d.students || []); setLoading(false); });
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [params.assessmentId]);

  const filtered = students.filter(s => {
    if (filter === 'active') return s.answered > 0;
    if (filter === 'suspicious') return (s.tab_switches || 0) > 0;
    return true;
  });

  const activeCount = students.filter(s => s.answered > 0).length;
  const suspiciousCount = students.filter(s => (s.tab_switches || 0) > 0).length;

  return (
    <div className="min-h-screen bg-background animate-fade-in relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[5%] right-[10%] w-[30rem] h-[30rem] bg-indigo-500/5 dark:bg-indigo-500/10 blur-[120px] rounded-full animate-pulse-soft pointer-events-none" />
      <div className="absolute bottom-[10%] left-[5%] w-[40rem] h-[40rem] bg-purple-500/5 dark:bg-purple-500/10 blur-[120px] rounded-full animate-pulse-soft pointer-events-none" style={{ animationDelay: '2s' }} />

      <nav className="glass border-b border-gray-200 dark:border-white/5 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-indigo-500/10 border border-indigo-500/20">👁️</div>
          <div>
            <span className="font-black text-foreground text-lg tracking-tight">Live Monitor</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">Live Updates On</span>
            </div>
          </div>
        </div>
        <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm font-bold transition-all bg-gray-100 dark:bg-white/5 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/5">← Dashboard</Link>
      </nav>

      <div className="max-w-5xl mx-auto p-8 lg:p-12">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            { label: 'Total Students', value: students.length, color: 'text-foreground', icon: '👥', accent: 'bg-indigo-500/5' },
            { label: 'Active Now', value: activeCount, color: 'text-emerald-600 dark:text-emerald-400', icon: '✅', accent: 'bg-emerald-500/5' },
            { label: 'Warnings', value: suspiciousCount, color: 'text-red-600 dark:text-red-400', icon: '⚠️', accent: 'bg-red-500/5' },
          ].map((s, idx) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="glass-premium p-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm text-center relative overflow-hidden group">
               <div className={`absolute top-0 right-0 w-24 h-24 ${s.accent} blur-3xl rounded-full translate-x-12 -translate-y-12`} />
               <p className="text-2xl mb-4 group-hover:scale-110 transition-transform">{s.icon}</p>
               <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-60">{s.label}</p>
               <p className={`text-4xl font-black tabular-nums tracking-tighter ${s.color}`}>{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex justify-between items-center mb-8 bg-gray-100 dark:bg-black/20 p-1.5 rounded-[1.5rem] border border-gray-200 dark:border-white/5 w-full md:w-fit group">
          {(['all', 'active', 'suspicious'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-8 py-3 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                filter === f
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xl border border-gray-100 dark:border-white/5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}>
              {f} {f === 'all' ? `[${students.length}]` : f === 'active' ? `[${activeCount}]` : `[${suspiciousCount}]`}
            </button>
          ))}
        </div>

        {loading && (
           <div className="flex flex-col items-center justify-center py-20 animate-pulse">
              <div className="w-12 h-12 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin mb-4" />
              <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest leading-none">Loading Students...</p>
           </div>
        )}

        {/* Student Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
          <AnimatePresence>
            {filtered.map((s: any) => {
              const hasSwitched = (s.tab_switches || 0) > 0;
              const pct = s.total_questions ? Math.round((s.answered / s.total_questions) * 100) : 0;
              return (
                <motion.div key={s.usn} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  className={`glass-premium border rounded-[2.5rem] p-8 shadow-sm transition-all duration-500 hover:shadow-2xl group relative overflow-hidden ${hasSwitched ? 'border-red-500/20 bg-red-500/5 ring-1 ring-red-500/10' : 'border-gray-100 dark:border-white/5'}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="font-black text-foreground text-lg mb-1 tracking-tight truncate max-w-[150px]">{s.name}</p>
                      <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest opacity-60 italic">{s.usn}</p>
                    </div>
                    {hasSwitched && (
                      <span className="bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl shadow-inner animate-pulse">
                        Warning {s.tab_switches}x
                      </span>
                    )}
                  </div>
                  {/* Progress */}
                  <div className="mt-8">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3 opacity-60 italic">
                      <span>Progress</span>
                      <span className="text-foreground">{s.answered}/{s.total_questions} Solved</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 dark:bg-black/40 rounded-full overflow-hidden p-0.5 border border-gray-200 dark:border-white/10 shadow-inner">
                      <motion.div className={`h-full rounded-full transition-all duration-1000 ${hasSwitched ? 'bg-red-500' : 'premium-gradient'}`}
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {s.last_activity && (
                    <p className="text-muted-foreground text-[9px] font-black uppercase tracking-[0.2em] mt-6 flex items-center gap-2 opacity-40">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Sync: {new Date(s.last_activity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
