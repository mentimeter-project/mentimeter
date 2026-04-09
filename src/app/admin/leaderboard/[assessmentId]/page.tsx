'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const medals = ['🥇', '🥈', '🥉'];

export default function AdminLeaderboardPage() {
  const params = useParams();
  const [leaderboard, setLeaderboard] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = () => {
      fetch(`/api/admin/leaderboard/${params.assessmentId}`)
        .then(r => r.json()).then(d => { setLeaderboard(d.leaderboard || []); setLoading(false); });
    };
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [params.assessmentId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 animate-fade-in">
      <nav className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-white/30 dark:border-slate-700/40 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xl">🏆</span>
          <div>
            <span className="font-bold text-slate-800 dark:text-white">Live Leaderboard</span>
            <span className="ml-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/50 text-xs font-semibold px-2 py-0.5 rounded-full">
              Auto-refreshing
            </span>
          </div>
        </div>
        <Link href="/admin" className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm font-medium transition-colors">← Dashboard</Link>
      </nav>

      <div className="max-w-2xl mx-auto p-6 space-y-3">
        {loading && <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-10">Loading...</p>}

        {!loading && leaderboard.length === 0 && (
          <div className="text-center py-20 animate-slide-up">
            <p className="text-4xl mb-3">⏳</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm">No submissions yet. Waiting for students...</p>
          </div>
        )}

        {!loading && leaderboard.length > 0 && (
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{leaderboard.length} student{leaderboard.length > 1 ? 's' : ''} ranked</p>
        )}

        {leaderboard.map((s, i) => (
          <div key={s.usn as string}
            className={`border rounded-2xl p-5 flex items-center gap-5 transition-all duration-300 hover:shadow-xl backdrop-blur-lg relative overflow-hidden ${
              i === 0 ? 'border-amber-300/60 dark:border-amber-600/40 bg-gradient-to-r from-amber-50/80 to-white/60 dark:from-amber-900/20 dark:to-slate-800/50 shadow-lg shadow-amber-200/40 dark:shadow-amber-900/20 hover:-translate-y-1.5 my-3 scale-[1.03] z-10' :
              i === 1 ? 'border-slate-300/60 dark:border-slate-600/40 bg-gradient-to-r from-slate-100/80 to-white/60 dark:from-slate-800/60 dark:to-slate-800/30 shadow-md hover:-translate-y-1 my-2 scale-[1.015] z-10' :
              i === 2 ? 'border-orange-300/50 dark:border-orange-700/40 bg-gradient-to-r from-orange-50/80 to-white/60 dark:from-orange-900/20 dark:to-slate-800/50 shadow-md shadow-orange-100/50 dark:shadow-orange-900/20 hover:-translate-y-1 my-1 z-10' :
              'border-white/40 dark:border-slate-700/40 bg-white/50 dark:bg-slate-800/40 shadow hover:-translate-y-0.5'
            }`}>
            {i === 0 && <div className="absolute inset-0 bg-gradient-to-r from-amber-400/10 to-transparent pointer-events-none" />}
            {i === 1 && <div className="absolute inset-0 bg-gradient-to-r from-slate-400/10 to-transparent pointer-events-none" />}
            {i === 2 && <div className="absolute inset-0 bg-gradient-to-r from-orange-400/10 to-transparent pointer-events-none" />}
            
            <div className="w-12 text-center flex items-center justify-center relative">
              {i < 3
                ? <span className="text-4xl drop-shadow-md">{medals[i]}</span>
                : <span className="text-slate-400 dark:text-slate-500 font-bold text-lg">#{i + 1}</span>}
            </div>
            <div className="flex-1 relative">
              <p className="font-bold text-slate-800 dark:text-white text-lg">{s.name as string}</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium tracking-wide">{s.usn as string} • <span className="text-indigo-600 dark:text-indigo-400">{s.answered as number}/{s.total_questions as number}</span> answered</p>
            </div>
            <div className="text-right relative">
              <p className={`text-4xl font-black tabular-nums tracking-tighter ${i === 0 ? 'text-amber-600 dark:text-amber-400' : i === 1 ? 'text-slate-600 dark:text-slate-300' : i === 2 ? 'text-orange-600 dark:text-orange-400' : 'text-indigo-600 dark:text-indigo-400'}`}>{(s.score as number) || 0}</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs font-medium uppercase tracking-wider">/ {(s.total_marks as number) || 0} marks</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
