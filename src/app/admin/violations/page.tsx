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
    <div className="min-h-screen bg-slate-50 p-6">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-slate-800">
          🚨 Live Cheating Monitor
        </h1>
        <span className="text-xs text-slate-400">
          Auto-refresh every 2s
        </span>
      </div>

      {/* Empty */}
      {data.length === 0 && (
        <p className="text-slate-400">No violations yet</p>
      )}

      {/* List */}
      <div className="space-y-3">
        {data.map((v, i) => {
          const count = stats[v.usn] || 1;

          return (
            <div key={i}
              className={`bg-white border rounded-xl p-4 flex justify-between ${
                count >= 3 ? 'border-red-400 bg-red-50/30' : 'border-slate-200'
              }`}
            >
              <div>
                <p className="font-semibold text-slate-800">{v.name}</p>
                <p className="text-xs text-slate-400">{v.usn}</p>
                <p className={`text-xs mt-1 font-semibold ${
                  count >= 3 ? 'text-red-600' : 'text-amber-600'
                }`}>
                  {count} violation{count > 1 ? 's' : ''}
                </p>
              </div>

              <div className="text-right">
                <p className="text-red-600 font-bold text-sm">{v.type}</p>
                <p className="text-xs text-slate-400">
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