'use client';

import { useEffect, useState } from 'react';

export default function ViolationsPage() {
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});

  const load = async () => {
    const res = await fetch('/api/admin/violations');

    if (!res.ok) return;

    const d = await res.json();
    const violations = d.violations || [];

    setData(violations);

    // count per student
    const map: Record<string, number> = {};
    violations.forEach((v: any) => {
      map[v.usn] = (map[v.usn] || 0) + 1;
    });

    setStats(map);
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 2000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 p-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-2xl font-black text-white tracking-tight">
          🚨 Live Monitor <span className="text-red-500 ml-2 animate-pulse">●</span>
        </h1>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          Auto-refresh active
        </span>
      </div>

      {/* Empty */}
      {data.length === 0 && (
        <div className="bg-slate-900/40 border-2 border-dashed border-slate-800 rounded-[2.5rem] p-20 text-center">
          <p className="text-4xl mb-4">🛡️</p>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No violations detected so far.</p>
        </div>
      )}

      {/* List */}
      <div className="space-y-4 max-w-2xl">
        {data.map((v, i) => {
          const count = stats[v.usn] || 1;
          const isExtreme = count >= 3;

          return (
            <div key={i}
              className={`glass-premium rounded-2xl p-6 flex justify-between gap-6 border-2 transition-all ${
                isExtreme ? 'border-red-500/30 bg-red-500/5 shadow-lg shadow-red-500/10' : 'border-white/5 bg-slate-900/40'
              }`}
            >
              <div>
                <p className="text-lg font-black text-white mb-0.5">{v.name}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{v.usn}</p>
                <div className={`inline-flex items-center gap-2 mt-4 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                  isExtreme ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {count} violation{count > 1 ? 's' : ''} recorded
                </div>
              </div>

              <div className="flex flex-col justify-between items-end">
                <p className="text-red-500 font-black text-xs uppercase tracking-[0.2em] bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20">{v.type}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">
                  {new Date(v.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}