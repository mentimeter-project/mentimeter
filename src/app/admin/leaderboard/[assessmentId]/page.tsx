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
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xl">🏆</span>
          <div>
            <span className="font-bold text-slate-800">Live Leaderboard</span>
            <span className="ml-2 bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-semibold px-2 py-0.5 rounded-full">
              Auto-refreshing
            </span>
          </div>
        </div>
        <Link href="/admin" className="text-slate-400 hover:text-slate-600 text-sm font-medium">← Dashboard</Link>
      </nav>

      <div className="max-w-2xl mx-auto p-6 space-y-3">
        {loading && <p className="text-slate-400 text-sm text-center py-10">Loading...</p>}

        {!loading && leaderboard.length === 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">⏳</p>
            <p className="text-slate-400 text-sm">No submissions yet. Waiting for students...</p>
          </div>
        )}

        {leaderboard.map((s, i) => (
          <div key={s.usn as string}
            className={`bg-white border rounded-2xl p-4 flex items-center gap-4 shadow-sm transition-all ${
              i === 0 ? 'border-amber-200 bg-amber-50/40' :
              i === 1 ? 'border-slate-300 bg-slate-50/60' :
              i === 2 ? 'border-orange-200 bg-orange-50/30' :
              'border-slate-200'
            }`}>
            <div className="w-10 text-center">
              {i < 3
                ? <span className="text-2xl">{medals[i]}</span>
                : <span className="text-slate-400 font-bold text-sm">#{i + 1}</span>}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-800">{s.name as string}</p>
              <p className="text-slate-400 text-xs font-mono">{s.usn as string} · {s.answered as number}/{s.total_questions as number} answered</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-indigo-600">{(s.score as number) || 0}</p>
              <p className="text-slate-400 text-xs">/ {(s.total_marks as number) || 0} marks</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
