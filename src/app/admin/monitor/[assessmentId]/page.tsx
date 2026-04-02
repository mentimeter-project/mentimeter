'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

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
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-800">👁 Live Monitor</span>
          <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-semibold px-2 py-0.5 rounded-full animate-pulse">
            LIVE
          </span>
        </div>
        <Link href="/admin" className="text-slate-400 hover:text-slate-600 text-sm font-medium">← Dashboard</Link>
      </nav>

      <div className="max-w-5xl mx-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Students', value: students.length, color: 'text-slate-700' },
            { label: 'Active (answered ≥1)', value: activeCount, color: 'text-emerald-600' },
            { label: 'Tab Switches', value: suspiciousCount, color: 'text-red-500' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-center">
              <p className="text-slate-400 text-xs mb-1">{s.label}</p>
              <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4">
          {(['all', 'active', 'suspicious'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors capitalize ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-500 hover:border-indigo-300'
              }`}>
              {f} {f === 'all' ? `(${students.length})` : f === 'active' ? `(${activeCount})` : `(${suspiciousCount})`}
            </button>
          ))}
        </div>

        {loading && <p className="text-slate-400 text-sm">Loading...</p>}

        {/* Student Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s: any) => {
            const hasSwitched = (s.tab_switches || 0) > 0;
            const pct = s.total_questions ? Math.round((s.answered / s.total_questions) * 100) : 0;
            return (
              <div key={s.usn}
                className={`bg-white border rounded-2xl p-4 shadow-sm ${hasSwitched ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{s.name}</p>
                    <p className="text-slate-400 text-xs font-mono">{s.usn}</p>
                  </div>
                  {hasSwitched && (
                    <span className="bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                      ⚠️ {s.tab_switches}x
                    </span>
                  )}
                </div>
                {/* Progress */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Progress</span>
                    <span>{s.answered}/{s.total_questions}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${hasSwitched ? 'bg-red-400' : 'bg-emerald-500'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {s.last_activity && (
                  <p className="text-slate-300 text-xs mt-2">
                    Last active: {new Date(s.last_activity).toLocaleTimeString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
