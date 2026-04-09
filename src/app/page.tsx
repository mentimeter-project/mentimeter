'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'admin'>('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleDark = () => {
    document.documentElement.classList.add('transitioning');
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    setDark(isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    setTimeout(() => document.documentElement.classList.remove('transitioning'), 350);
  };

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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorative blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-indigo-400/20 to-purple-400/10 dark:from-indigo-600/10 dark:to-purple-600/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-teal-400/15 to-indigo-400/10 dark:from-teal-600/5 dark:to-indigo-600/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />

      {/* Dark mode toggle */}
      <button onClick={toggleDark}
        className="absolute top-5 right-5 z-20 w-10 h-10 rounded-xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-white/40 dark:border-slate-700/50 shadow-lg flex items-center justify-center text-lg hover:scale-110 active:scale-95 transition-all"
        aria-label="Toggle dark mode">
        {dark ? '☀️' : '🌙'}
      </button>

      <div className="w-full max-w-md relative z-10 animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <span className="text-white font-black text-lg">M</span>
            </div>
            <span className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Mentimeter</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{greeting}! Welcome to your assessment portal.</p>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">SJB Institute of Technology · AI &amp; ML Sec A</p>
        </div>

        {/* Card */}
        <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-xl shadow-indigo-100/40 dark:shadow-black/20 border border-white/40 dark:border-slate-700/50 p-8 transition-all duration-300 hover:shadow-2xl hover:-translate-y-0.5">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-1">Sign in to your account</h2>
          <p className="text-slate-400 dark:text-slate-500 text-sm mb-6">Choose your role and enter your credentials</p>

          {/* Role Toggle */}
          <div className="flex bg-slate-100/60 dark:bg-slate-700/40 backdrop-blur-sm rounded-xl p-1 mb-6 gap-1 border border-white/40 dark:border-slate-600/30">
            {(['student', 'admin'] as const).map(r => (
              <button key={r} onClick={() => setRole(r)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  role === r
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}>
                {r === 'admin' ? '⚙ Admin' : '🎓 Student'}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Username</label>
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)} required
                placeholder={role === 'admin' ? 'admin' : 'e.g. gagan.g'}
                className="w-full bg-white/50 dark:bg-slate-700/50 border border-slate-200/60 dark:border-slate-600/40 rounded-xl px-4 py-3 text-slate-800 dark:text-white text-sm placeholder-slate-300 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all hover:bg-white/80 dark:hover:bg-slate-700/70 shadow-inner focus:bg-white dark:focus:bg-slate-700 focus:shadow-md"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder={role === 'admin' ? 'admin123' : 'Your USN (e.g. 1JB23AI015)'}
                className="w-full bg-white/50 dark:bg-slate-700/50 border border-slate-200/60 dark:border-slate-600/40 rounded-xl px-4 py-3 text-slate-800 dark:text-white text-sm placeholder-slate-300 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all hover:bg-white/80 dark:hover:bg-slate-700/70 shadow-inner focus:bg-white dark:focus:bg-slate-700 focus:shadow-md"
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800/50 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.98] text-white font-bold tracking-wide py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 mt-4 hover:scale-[1.01] focus:ring-4 focus:ring-indigo-500/30 focus:outline-none">
              {loading ? 'Signing in...' : `Sign in as ${role === 'admin' ? 'Admin' : 'Student'}`}
            </button>
          </form>

          <div className="mt-6 p-4 bg-slate-50/80 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-600/30">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Login Format</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Students: <span className="text-slate-700 dark:text-slate-300 font-medium">firstname.lastname</span> / <span className="text-slate-700 dark:text-slate-300 font-medium">USN</span></p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">e.g. <span className="font-mono text-indigo-600 dark:text-indigo-400">gagan.g</span> / <span className="font-mono text-indigo-600 dark:text-indigo-400">1JB23AI015</span></p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Admin: <span className="font-mono text-indigo-600 dark:text-indigo-400">admin</span> / <span className="font-mono text-indigo-600 dark:text-indigo-400">admin123</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
