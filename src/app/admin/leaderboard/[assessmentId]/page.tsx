'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const medals = ['🥇', '🥈', '🥉'];

export default function AdminLeaderboardPage() {
  const params = useParams();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
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
    <div className="min-h-screen bg-background animate-fade-in">
      <nav className="glass border-b border-gray-200 dark:border-white/5 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-500/10 rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-amber-500/10 border border-amber-500/20">🏆</div>
          <div>
            <span className="font-black text-foreground text-lg tracking-tight">Leaderboard</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">Live Updates On</span>
            </div>
          </div>
        </div>
        <Link href="/admin" className="text-muted-foreground hover:text-foreground text-sm font-bold transition-all bg-gray-100 dark:bg-white/5 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/5">← Dashboard</Link>
      </nav>

      <div className="max-w-2xl mx-auto p-8 space-y-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
            <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest leading-none">Loading Scores...</p>
          </div>
        )}

        {!loading && leaderboard.length === 0 && (
          <div className="text-center py-24 glass-premium border-2 border-dashed border-gray-200 dark:border-white/10 rounded-[3rem]">
            <p className="text-5xl mb-6">⏳</p>
            <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Waiting for student submissions...</p>
          </div>
        )}

        {!loading && leaderboard.length > 0 && (
          <div className="flex items-center justify-between mb-8 px-4">
            <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest italic">{leaderboard.length} Students Submitted</p>
            <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest italic">Scoring System</p>
          </div>
        )}

        {leaderboard.map((s, i) => (
          <div key={s.usn}
            className={`border rounded-3xl p-6 flex items-center gap-6 transition-all duration-300 hover:shadow-2xl glass-premium relative overflow-hidden ${
              i === 0 ? 'border-amber-500/30 bg-amber-500/5 shadow-2xl scale-[1.05] z-10 mb-6' :
              i === 1 ? 'border-gray-400/30 bg-gray-400/5 shadow-xl scale-[1.02] z-10 mb-2' :
              i === 2 ? 'border-orange-500/30 bg-orange-500/5 shadow-lg z-10' :
              'border-gray-100 dark:border-white/5 group hover:bg-white dark:hover:bg-white/5 shadow-sm'
            }`}>
            {i === 0 && <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent pointer-events-none" />}
            
            <div className="w-12 text-center flex items-center justify-center relative">
              {i < 3
                ? <span className="text-4xl drop-shadow-md">{medals[i]}</span>
                : <span className="text-muted-foreground font-black text-xl italic tracking-tighter opacity-40">#{i + 1}</span>}
            </div>
            <div className="flex-1 relative">
              <p className="font-black text-foreground text-lg tracking-tight mb-0.5">{s.name}</p>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-2 py-0.5 rounded-md">{s.usn}</span>
                <span className="text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest italic">{s.answered}/{s.total_questions} Complete</span>
              </div>
            </div>
            <div className="text-right relative">
              <p className={`text-4xl font-black tabular-nums tracking-tighter ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-500' : 'text-indigo-500'}`}>{s.score || 0}</p>
              <p className="text-muted-foreground text-[9px] font-black uppercase tracking-[0.3em] opacity-40 italic">Total Points</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
