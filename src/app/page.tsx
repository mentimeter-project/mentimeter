'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'admin'>('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Login failed'); return; }
    router.push(role === 'admin' ? '/admin' : '/student');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white font-black text-base">M</span>
            </div>
            <span className="text-2xl font-bold text-slate-800 tracking-tight">Mentimeter</span>
          </div>
          <p className="text-slate-500 text-sm">SJB Institute of Technology · AI & ML Sec A</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Sign in to your account</h2>
          <p className="text-slate-400 text-sm mb-6">Choose your role and enter your credentials</p>

          {/* Role Toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1 mb-6 gap-1">
            {(['student', 'admin'] as const).map(r => (
              <button key={r} onClick={() => setRole(r)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  role === r
                    ? 'bg-white text-indigo-600 shadow-sm shadow-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}>
                {r === 'admin' ? '⚙ Admin' : '🎓 Student'}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Username</label>
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)} required
                placeholder={role === 'admin' ? 'admin' : 'e.g. gagan.g'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm placeholder-slate-300 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder={role === 'admin' ? 'admin123' : 'Your USN (e.g. 1JB23AI015)'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm placeholder-slate-300 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-md shadow-indigo-200 disabled:opacity-50 mt-2">
              {loading ? 'Signing in...' : `Sign in as ${role === 'admin' ? 'Admin' : 'Student'}`}
            </button>
          </form>

          <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Login Format</p>
            <p className="text-xs text-slate-500">Students: <span className="text-slate-700 font-medium">firstname.lastname</span> / <span className="text-slate-700 font-medium">USN</span></p>
            <p className="text-xs text-slate-500 mt-0.5">e.g. <span className="font-mono text-indigo-600">gagan.g</span> / <span className="font-mono text-indigo-600">1JB23AI015</span></p>
            <p className="text-xs text-slate-500 mt-1">Admin: <span className="font-mono text-indigo-600">admin</span> / <span className="font-mono text-indigo-600">admin123</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
