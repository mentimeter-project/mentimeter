'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'admin'>('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Sync initial state
    setDark(document.documentElement.classList.contains('dark'));
    
    // Listen for storage changes from other tabs
    const syncTheme = () => setDark(document.documentElement.classList.contains('dark'));
    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  }, []);

  const toggleDark = () => {
    const html = document.documentElement;
    html.classList.add('transitioning');
    
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setDark(false);
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setDark(true);
    }
    
    setTimeout(() => html.classList.remove('transitioning'), 500);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      router.push(role === 'admin' ? '/admin' : '/student');
    } catch {
      setError('Connection refused. Please try again.');
      setLoading(false);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-background mesh-gradient flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Blobs moved to mesh-gradient via globals.css, but we'll add some extra depth */}
      <div className="absolute top-[10%] right-[15%] w-[40rem] h-[40rem] bg-indigo-500/10 blur-[120px] rounded-full animate-pulse-soft pointer-events-none" />
      <div className="absolute bottom-[5%] left-[10%] w-[30rem] h-[30rem] bg-purple-500/10 blur-[100px] rounded-full animate-pulse-soft pointer-events-none" style={{ animationDelay: '1s' }} />

      <motion.button 
        whileHover={{ scale: 1.1, rotate: 5 }} 
        whileTap={{ scale: 0.9 }} 
        onClick={toggleDark}
        className="absolute top-10 right-10 z-50 w-12 h-12 rounded-2xl glass flex items-center justify-center text-xl shadow-2xl transition-all text-slate-700 dark:text-slate-300"
        aria-label="Toggle dark mode">
        {dark ? '☀️' : '🌙'}
      </motion.button>

      <div className="w-full max-w-[440px] relative z-10">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} 
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-4 mb-4">
            <motion.div 
              whileHover={{ rotate: 10 }}
              className="w-12 h-12 premium-gradient rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20"
            >
              <span className="text-white font-black text-xl">M</span>
            </motion.div>
            <span className="text-3xl font-black text-foreground tracking-tight">Mentimeter</span>
          </div>
          <p className="text-muted-foreground font-bold tracking-tight opacity-70">{greeting}! Welcome to your secure assessment portal.</p>
        </motion.div>

        {/* Login Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 30 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }} 
          className="glass-premium p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden"
        >
          {/* Subtle internal gradient glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 blur-[60px] rounded-full pointer-events-none" />
          
          <div className="mb-8 relative z-10">
            <h2 className="text-2xl font-black tracking-tight text-foreground mb-1.5 leading-none">Welcome back 👋</h2>
            <p className="text-muted-foreground text-sm font-medium opacity-80">Ready to solve some problems today?</p>
          </div>

          {/* Role Toggle */}
          <div className="flex bg-gray-100 dark:bg-black/40 backdrop-blur-md rounded-2xl p-1.5 mb-8 gap-1.5 border border-gray-200/50 dark:border-white/5 shadow-inner relative z-10">
            {(['student', 'admin'] as const).map(r => (
              <button key={r} onClick={() => setRole(r)}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                  role === r
                    ? 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 text-indigo-600 dark:text-indigo-400 shadow-xl'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}>
                {r === 'admin' ? '⚙ Admin' : '🎓 Student'}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-6 relative z-10">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1 opacity-70">Username</label>
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)} required
                placeholder={role === 'admin' ? 'admin' : 'firstname.lastname'}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1 opacity-70">Secure Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder={role === 'admin' ? '••••••••' : 'Your Student ID / USN'}
                className="w-full"
              />
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-black uppercase tracking-widest px-4 py-4 rounded-2xl flex items-center gap-3"
                >
                  <span className="text-lg">⚠️</span> {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button 
              whileHover={{ scale: 1.02, y: -2 }} 
              whileTap={{ scale: 0.98 }} 
              type="submit" 
              disabled={loading}
              className="w-full premium-gradient text-white font-black tracking-widest uppercase text-[11px] py-5 rounded-2xl transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 mt-4 disabled:scale-100 flex items-center justify-center gap-3"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : `Access Portal as ${role}`}
            </motion.button>
            <p className="text-center text-[9px] text-muted-foreground/50 font-black uppercase tracking-[0.25em] pt-2">Protected by Adaptive Security Layer</p>
          </form>

          {/* Quick Help */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-white/5 relative z-10">
            <div className="flex items-center justify-between mb-5">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Session Nodes</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500/80">v4.2.0-STABLE</span>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500 opacity-80 block">Access Strategy</span>
                <span className="text-[10px] font-bold text-muted-foreground leading-snug block opacity-70">Use internal LDAP or USN credentials.</span>
              </div>
              <div className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-purple-500 opacity-80 block">Sentinel Guard</span>
                <span className="text-[10px] font-bold text-muted-foreground leading-snug block opacity-70">Active monitoring for tab-switching active.</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Footer info */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 0.4 }} 
          transition={{ delay: 0.8 }} 
          className="text-center mt-8 space-y-1"
        >
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground">SJB Institute of Technology · Autonomous</p>
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground">Faculty of AI & Machine Learning · Section A</p>
        </motion.div>
      </div>
    </div>
  );
}

