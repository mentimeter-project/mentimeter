'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { LANGUAGES, type Language } from '@/components/CodeEditor';
import EvalResultCard, { EvalResultSkeleton } from '@/components/EvalResultCard';
import { getDriverTemplate } from '@/lib/driverTemplates';

const CodeEditor = dynamic(() => import('@/components/CodeEditor'), { ssr: false });

type Tab = 'questions' | 'leaderboard';

// Motivational messages based on progress
const getEncouragement = (answered: number, total: number, timeLeft: number | null) => {
  if (total === 0) return '';
  const pct = answered / total;
  if (pct === 1) return '🎯 All questions answered! Review and submit when ready.';
  if (pct >= 0.75) return '🔥 Almost there! Just a few more to go.';
  if (pct >= 0.5) return '💪 Halfway done — great progress!';
  if (pct >= 0.25) return '📝 Good start! Keep the momentum going.';
  if (timeLeft !== null && timeLeft < 300) return '⏰ Time is running low!';
  return '✨ Take your time and do your best.';
};

export default function StudentPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('questions');
  const [assessment, setAssessment] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answeredMap, setAnsweredMap] = useState<Record<number, any>>({});
  const [activeQ, setActiveQ] = useState(0);
  const [draftAnswers, setDraftAnswers] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState<Record<number, string>>({});
  // ── Code question state ──
  const [codeDrafts, setCodeDrafts] = useState<Record<number, { code: string; languageId: number }>>({});
  const [questionTemplates, setQuestionTemplates] = useState<Record<number, Record<number, string>>>({});
  const [evaluating, setEvaluating] = useState<number | null>(null);
  const [evalResults, setEvalResults] = useState<Record<number, any>>({});
  
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{
    output: string;
    stdout?: string;
    stderr?: string;
    isCorrect: boolean;
    isError: boolean;
    exitCode?: number;
  } | null>(null);
  

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState('');
  const [name, setName] = useState('');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWarningBanner, setShowWarningBanner] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [allSubmitted, setAllSubmitted] = useState(false);
  const [dark, setDark] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const tabSwitchRef = useRef(0);

  /** Get starter code for a question+language, preferring function-mode templates */
  const getStarterCode = (questionId: number, languageId: number): string => {
    const tmpl = questionTemplates[questionId];
    if (tmpl?.[languageId]) return tmpl[languageId];
    return LANGUAGES.find(l => l.id === languageId)?.boilerplate ?? '';
  };

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
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

  const fetchAssessment = useCallback(async () => {
    const res = await fetch('/api/student/active-assessment');
    const data = await res.json();
    setAssessment(data.assessment || null);
    setQuestions(data.questions || []);
    setAnsweredMap(data.answeredMap || {});
    setQuestionTemplates(data.questionTemplates || {});
    if (data.assessment && startTimeRef.current === null) {
      startTimeRef.current = Date.now();
      setTimeLeft(((data.assessment.duration_minutes as number) || 30) * 60);
    }
    setLoading(false);
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    const res = await fetch('/api/student/leaderboard');
    const data = await res.json();
    setLeaderboard(data.leaderboard || []);
    setCurrentUser(data.currentUser || '');
  }, []);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.loggedIn || d.role !== 'student') { router.push('/'); return; }
      setName(d.name);
    });
    fetchAssessment();
    fetchLeaderboard();
    const i1 = setInterval(fetchAssessment, 8000);
    const i2 = setInterval(fetchLeaderboard, 5000);
    return () => { clearInterval(i1); clearInterval(i2); };
  }, [router, fetchAssessment, fetchLeaderboard]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    // Auto-submit when time runs out
    if (timeLeft === 1) {
      handleSubmitAll(true);
      return;
    }
    // Warning at 5 min
    if (timeLeft === 300) setShowWarningBanner(true);
    timerRef.current = setTimeout(() => setTimeLeft(t => (t ?? 1) - 1), 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [timeLeft]);

  // Tab switch / visibility detection (anti-cheat)
  useEffect(() => {
    if (!assessment) return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchRef.current += 1;
        setTabSwitchCount(tabSwitchRef.current);
        setShowWarningBanner(true);
        // Log tab switch to server
        fetch('/api/student/log-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'tab_switch', count: tabSwitchRef.current }),
        }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [assessment]);

  // Disable right-click and copy-paste during exam
  useEffect(() => {
    if (!assessment) return;
    const preventCopy = (e: ClipboardEvent) => e.preventDefault();
    const preventContext = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('copy', preventCopy);
    document.addEventListener('contextmenu', preventContext);
    return () => {
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('contextmenu', preventContext);
    };
  }, [assessment]);

  const saveAnswer = async (questionId: number) => {
    const text = draftAnswers[questionId];
    if (!text?.trim()) return;
    setSaving(questionId);
    await fetch('/api/student/save-answer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, answerText: text }),
    });
    setAnsweredMap(prev => ({ ...prev, [questionId]: { answer_text: text } }));
    setSavedAt(prev => ({ ...prev, [questionId]: new Date().toLocaleTimeString() }));
    setSaving(null);
  };

  const runCode = async (questionId: number, sourceCode: string, languageId: number, expectedOutput: string, driverCode: string) => {
    setRunning(true);
    setRunResult(null);

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_code: sourceCode,
          language_id: languageId,
          expected_output: expectedOutput || '',
          driver_code: driverCode || '',
          stdin: '',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setRunResult({
          output: data.error || 'Execution failed',
          isCorrect: false,
          isError: true,
        });
        return;
      }

      setRunResult({
        output: data.output || 'Code executed but produced no output',
        stdout: data.stdout || '',
        stderr: data.stderr || '',
        isCorrect: data.isCorrect,
        isError: data.isError,
        exitCode: data.exitCode,
      });

    } catch (err: any) {
      setRunResult({
        output: 'Network error — could not reach execution engine',
        isCorrect: false,
        isError: true,
      });
    } finally {
      setRunning(false);
    }
  };

  const handleSubmitAll = async (forced = false) => {
    if (!forced && !showSubmitConfirm) {
      setShowSubmitConfirm(true);
      return;
    }
    setShowSubmitConfirm(false);
    // Save all unsaved drafts
    for (const q of questions) {
      const qid = q.id as number;
      if (draftAnswers[qid]?.trim() && !answeredMap[qid]?.answer_text) {
        await saveAnswer(qid);
      }
    }
    setAllSubmitted(true);
  };

  const requestFullscreen = () => {
    document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
  };

  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/'); };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(answeredMap).filter(k => (answeredMap[parseInt(k)]?.answer_text as string)).length;
  const myRank = leaderboard.findIndex(s => s.name === currentUser) + 1;
  const myScore = (leaderboard.find(s => s.name === currentUser)?.score as number) || 0;
  const isWarning = timeLeft !== null && timeLeft < 300;
  const isDanger = timeLeft !== null && timeLeft < 60;
  const firstName = name ? name.split('.')[0].charAt(0).toUpperCase() + name.split('.')[0].slice(1) : '';

  // All submitted screen
  if (allSubmitted) {
    return (
      <div className="h-screen flex items-center justify-center animate-fade-in relative overflow-hidden">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-premium p-12 text-center max-w-md relative z-10 rounded-[3rem] shadow-2xl">
          <motion.div initial={{ y: 20 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className="text-7xl mb-8">🎉</motion.div>
          <h2 className="text-4xl font-black tracking-tight mb-3 text-foreground italic">All Done!</h2>
          <p className="text-muted-foreground text-sm mb-8 font-medium leading-relaxed uppercase tracking-widest opacity-80">Your answers have been saved. Great effort today, {firstName}!</p>
          {myRank > 0 && (
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-[2rem] p-6 mb-10 shadow-inner">
              <p className="text-indigo-600 dark:text-indigo-400 font-black text-xl mb-1 tracking-tight">Rank: #{myRank}</p>
              <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">{myScore} Points Earned</p>
            </div>
          )}
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={logout} className="premium-gradient text-white font-black px-12 py-5 rounded-2xl shadow-xl shadow-indigo-500/30 uppercase tracking-[0.25em] text-[11px]">
            Log Out
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden selection:bg-indigo-500/30">
      {/* Modals & Overlays */}
      <AnimatePresence mode="wait">
        {showSubmitConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="glass-premium p-10 max-w-sm w-full rounded-[2.5rem] shadow-2xl">
              <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-lg shadow-amber-500/10 border border-amber-500/20">🛰️</div>
              <h3 className="text-2xl font-black mb-3 leading-none text-foreground">Submit Assignment?</h3>
              <p className="text-muted-foreground text-sm mb-8 font-medium leading-relaxed">You've successfully solved <span className="text-indigo-600 dark:text-indigo-400 font-black">{answeredCount}</span> out of <span className="text-foreground font-black">{questions.length}</span> problems. Confirm final submission to log results.</p>
              <div className="flex flex-col gap-3">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => handleSubmitAll(true)} className="w-full premium-gradient text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-500/20 uppercase tracking-widest text-[11px]">Confirm & Submit</motion.button>
                <button onClick={() => setShowSubmitConfirm(false)} className="w-full px-4 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">Back to Exam</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Nav */}
      <nav className="glass border-b border-gray-200 dark:border-white/5 px-8 h-20 flex justify-between items-center flex-shrink-0 z-50">
        <div className="flex items-center gap-5">
          <motion.div whileHover={{ rotate: 10 }} className="w-10 h-10 premium-gradient rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
            <span className="text-white font-black text-lg">M</span>
          </motion.div>
          <div className="flex flex-col">
            <span className="font-black text-lg tracking-tight text-foreground">Mentimeter</span>
            {assessment && <span className="text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">{assessment.title as string}</span>}
          </div>
        </div>

        <div className="flex items-center gap-8">
          <motion.button whileHover={{ scale: 1.1, rotate: 5 }} whileTap={{ scale: 0.9 }} onClick={toggleDark} className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-black/40 border border-gray-200 dark:border-white/5 flex items-center justify-center text-xl shadow-inner text-gray-700 dark:text-gray-300">
            {dark ? '☀️' : '🌙'}
          </motion.button>

          {timeLeft !== null && (
            <div className={`px-6 py-2.5 rounded-2xl text-[11px] font-black tracking-[0.1em] border-2 transition-all duration-300 flex items-center gap-3 ${
              isDanger ? 'bg-red-500/10 text-red-500 border-red-500 animate-pulse' :
              isWarning ? 'bg-amber-500/10 text-amber-500 border-amber-500' :
              'bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 shadow-sm'
            }`}>
              <span className="opacity-60 font-black">TIME LEFT</span>
              <span className="text-base tabular-nums">{formatTime(timeLeft)}</span>
            </div>
          )}

          <div className="hidden xl:flex flex-col items-end gap-2">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Done: {answeredCount}/{questions.length}</span>
              <div className="w-40 h-2 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden p-0.5 border border-gray-200 dark:border-white/5">
                <motion.div initial={{ width: 0 }} animate={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }} className="h-full premium-gradient rounded-full" />
              </div>
            </div>
            {myRank > 0 && <span className="text-[10px] font-black tracking-widest uppercase text-indigo-500">Live Rank: #{myRank}</span>}
          </div>

          <div className="h-10 w-[1px] bg-gray-200 dark:bg-white/5 mx-2" />

          <div className="flex items-center gap-4 group cursor-pointer">
            <div className="flex flex-col items-end">
              <span className="text-sm font-black leading-none text-foreground">Hi, {firstName}</span>
              <button onClick={logout} className="text-[9px] font-black text-muted-foreground hover:text-red-500 transition-colors uppercase tracking-[0.2em] mt-1.5 opacity-60 hover:opacity-100">Log Out</button>
            </div>
            <div className="w-11 h-11 premium-gradient rounded-2xl flex items-center justify-center text-white font-black shadow-xl shadow-indigo-500/10 border-2 border-white dark:border-gray-800 relative">
              <span className="text-lg">{name.charAt(0).toUpperCase()}</span>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-gray-900 rounded-full" />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <aside className="w-80 glass border-r border-gray-200 dark:border-white/5 p-8 flex flex-col gap-8 flex-shrink-0 relative z-40">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground opacity-60">Overview</h3>
              <span className="text-[9px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-lg font-black uppercase tracking-widest border border-indigo-500/20">{questions.length} Questions</span>
            </div>
            
            <div className="flex gap-1.5 p-1.5 bg-gray-100 dark:bg-black/40 rounded-2xl border border-gray-200/50 dark:border-white/5 shadow-inner">
              <button onClick={() => setTab('questions')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${tab === 'questions' ? 'bg-white dark:bg-gray-800 shadow-xl text-indigo-600 dark:text-indigo-400 border border-gray-200 dark:border-white/5' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>Questions</button>
              <button onClick={() => setTab('leaderboard')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${tab === 'leaderboard' ? 'bg-white dark:bg-gray-800 shadow-xl text-indigo-600 dark:text-indigo-400 border border-gray-200 dark:border-white/5' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>Leaderboard</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {tab === 'questions' ? questions.map((q, i) => {
              const ans = answeredMap[q.id as number];
              const acts = activeQ === i;
              return (
                <motion.button key={q.id as number} whileHover={{ x: 6 }} whileTap={{ scale: 0.98 }} onClick={() => setActiveQ(i)} 
                  className={`w-full group text-left p-5 rounded-2xl border-2 transition-all flex items-center gap-5 relative overflow-hidden ${
                    acts ? 'bg-white dark:bg-indigo-500/10 border-indigo-500/50 shadow-2xl shadow-indigo-500/10' :
                    ans ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                    'bg-gray-50 dark:bg-black/20 border-gray-200 dark:border-white/5 text-gray-500 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-800/40 hover:border-indigo-500/30'
                  }`}>
                  
                  {acts && <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-2xl rounded-full translate-x-12 -translate-y-12" />}
                  
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[11px] transition-all duration-300 ${
                    acts ? 'premium-gradient text-white shadow-lg shadow-indigo-500/20 rotate-3' :
                    ans ? 'bg-emerald-500 text-white' :
                    'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-slate-500 group-hover:bg-indigo-500 group-hover:text-white group-hover:rotate-6'
                  }`}>
                    {ans ? '✓' : String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-1 min-w-0 relative z-10">
                    <p className={`text-sm font-black truncate leading-tight tracking-tight ${acts ? 'text-foreground' : ''}`}>Question {i + 1}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500/70">{q.max_marks as number} Points</span>
                      <span className="w-1 h-1 rounded-full bg-slate-400 opacity-30" />
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-60 truncate">
                        {q.question_type === 'code_function' ? 'CODE (FUNCTION)' : q.question_type === 'code_stdin' ? 'CODE (I/O)' : 'TEXT'}
                      </span>
                    </div>
                  </div>

                  {acts && (
                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full absolute left-0" />
                  )}
                </motion.button>
              );
            }) : (
              <div className="space-y-3">
                {leaderboard.slice(0, 5).map((s, i) => (
                  <div key={i} className="p-4 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-2xl flex items-center gap-4 transition-all hover:bg-white dark:hover:bg-white/5">
                    <span className={`text-[10px] font-black w-6 h-6 rounded-lg flex items-center justify-center ${i === 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-gray-200 dark:bg-gray-800 text-muted-foreground'}`}>#{i+1}</span>
                    <span className="text-xs font-black truncate flex-1 text-foreground">{s.name as string}</span>
                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">{s.score as number} XP</span>
                  </div>
                ))}
                <button onClick={() => setTab('leaderboard')} className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-400 transition-colors flex items-center justify-center gap-2 group">
                  View Leaderboard <span className="group-hover:translate-x-1 transition-transform">→</span>
                </button>
              </div>
            )}
          </div>

          <div className="pt-8 border-t border-gray-100 dark:border-white/5 space-y-4">
            <motion.div initial={false} animate={{ opacity: isWarning ? 1 : 0.8 }} className="p-5 bg-gray-50 dark:bg-black/20 rounded-3xl border border-gray-200/50 dark:border-white/5 shadow-inner">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 mb-2 opacity-80">Progress</p>
              <p className="text-xs font-black italic line-clamp-2 leading-relaxed text-foreground opacity-90">{getEncouragement(answeredCount, questions.length, timeLeft)}</p>
            </motion.div>
            
            {activeQ === questions.length - 1 && (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowSubmitConfirm(true)} className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-[11px] shadow-xl shadow-emerald-500/20 uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3">
                <span className="text-lg">🏁</span> Submit Assessment
              </motion.button>
            )}
          </div>
        </aside>

        {/* Dynamic Content */}
        <main className="flex-1 overflow-y-auto p-12 lg:p-16 relative flex flex-col items-center custom-scrollbar">
          <AnimatePresence mode="wait">
            {tab === 'questions' ? (
              <motion.div key={activeQ} initial={{ opacity: 0, scale: 0.99, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ type: "spring", stiffness: 100, damping: 20 }} className="w-full max-w-5xl">
                {questions[activeQ] && (() => {
                  const q = questions[activeQ];
                  const qid = q.id as number;
                  const res = evalResults[qid];
                  const isEval = evaluating === qid;
                  const ans = answeredMap[qid];
                  const isSub = !!ans?.answer_text;
                  const draft = draftAnswers[qid] ?? ans?.answer_text ?? '';

                  return (
                    <div className="space-y-12">
                      <header className="space-y-6">
                        <div className="flex flex-wrap items-center gap-4">
                          <span className="px-4 py-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-[0.25em] rounded-xl border border-indigo-500/20 shadow-sm">Question {String(activeQ+1).padStart(2, '0')}</span>
                          <span className="px-4 py-1.5 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-gray-200 dark:border-white/5">{q.max_marks as number} Points</span>
                          {ans?.reviewed && <span className="px-4 py-1.5 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/20">Score: {ans.marks_awarded as number} Points</span>}
                        </div>
                        <div className="space-y-4">
                          <h2 className="text-4xl lg:text-5xl font-black tracking-tight text-balance leading-[1.15] text-foreground italic">{q.question_text as string}</h2>
                          <div className="flex items-center gap-3 opacity-60">
                            <span className="w-8 h-0.5 bg-indigo-500 rounded-full" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Do your best! Monitoring is active.</p>
                          </div>
                        </div>
                      </header>

                      <div className="space-y-8">
                        {q.question_type.startsWith('code') ? (
                          <div className="space-y-8">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 text-sm">💻</div>
                                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-foreground opacity-80">Write Code</h4>
                              </div>
                              {isSub && (
                                <div className="px-4 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-widest rounded-xl flex items-center gap-3 border border-emerald-500/20 shadow-sm">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Read-Only Mode
                                </div>
                              )}
                            </div>
                            
                            <div className="relative group p-1.5 rounded-[2.5rem] bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5 shadow-2xl transition-all duration-700 hover:ring-2 ring-indigo-500/20">
                              <CodeEditor
                                value={codeDrafts[qid]?.code ?? (isSub ? (ans.answer_text ?? '') : getStarterCode(qid, codeDrafts[qid]?.languageId ?? LANGUAGES[0].id))}
                                languageId={codeDrafts[qid]?.languageId ?? LANGUAGES[0].id}
                                disabled={isSub}
                                onChange={(c) => setCodeDrafts(p => ({ ...p, [qid]: { ...p[qid], code: c, languageId: p[qid]?.languageId ?? LANGUAGES[0].id } }))}
                                onLanguageChange={(l) => setCodeDrafts(p => ({ ...p, [qid]: { code: getStarterCode(qid, l.id), languageId: l.id } }))}
                              />
                            </div>

                            {!isSub && (
                              <div className="flex items-center justify-between gap-8 py-6 px-8 rounded-3xl bg-gray-50 dark:bg-indigo-500/5 border border-gray-200 dark:border-indigo-500/20">
                                <div className="space-y-1.5">
                                  <p className="text-xs font-black text-foreground uppercase tracking-wider">Run Test Cases</p>
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-relaxed max-w-xs">Run your code to check if it matches the expected output.</p>
                                </div>
                                <motion.button whileHover={{ scale: 1.05, filter: "brightness(1.1)" }} whileTap={{ scale: 0.95 }} onClick={() => {
                                  const langName = LANGUAGES.find(l => l.id === (codeDrafts[qid]?.languageId ?? LANGUAGES[0].id))?.name.toLowerCase() || '';
                                  // Map Judge0 name 'javascript (node.js)' to 'javascript'
                                  const parsedLang = langName.includes('javascript') ? 'javascript' : langName.includes('python') ? 'python' : langName;
                                  const driver = q.question_type === 'code_function' ? getDriverTemplate(parsedLang) : '';
                                  runCode(qid, codeDrafts[qid]?.code || '', codeDrafts[qid]?.languageId ?? LANGUAGES[0].id, '', driver);
                                }} disabled={running || !codeDrafts[qid]?.code?.trim()} className={`relative overflow-hidden premium-gradient text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-2xl flex items-center gap-4 transition-all ${running ? 'opacity-50 cursor-not-allowed grayscale' : 'shadow-indigo-500/30'}`}>
                                  {running ? (
                                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Executing...</>
                                  ) : (
                                    <><span className="text-base leading-none">🚀</span> Run Code</>
                                  )}
                                </motion.button>
                              </div>
                            )}

                            <AnimatePresence>
                              {running && <EvalResultSkeleton key="skeleton" statusText={`Executing your code, ${firstName}...`} />}
                              {!running && runResult && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 25 }}>
                                  <div className={`mt-4 rounded-2xl border p-4 ${
                                    runResult.isError
                                      ? 'bg-red-50 border-red-200'
                                      : runResult.isCorrect
                                        ? 'bg-emerald-50 border-emerald-200'
                                        : 'bg-amber-50 border-amber-200'
                                  }`}>
                                    {/* Status badge */}
                                    <div className="flex items-center gap-2 mb-3">
                                      {runResult.isError ? (
                                        <span className="text-red-600 font-semibold text-sm">⚠ Error</span>
                                      ) : runResult.isCorrect ? (
                                        <span className="text-emerald-600 font-semibold text-sm">✓ Correct Output</span>
                                      ) : (
                                        <span className="text-amber-600 font-semibold text-sm">✗ Wrong Answer</span>
                                      )}
                                    </div>

                                    {/* Output */}
                                    <div>
                                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Output</p>
                                      <pre className="bg-slate-900 text-emerald-400 rounded-xl p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                                        {runResult.output || 'No output'}
                                      </pre>
                                    </div>

                                    {/* Show stderr separately if present */}
                                    {runResult.stderr && runResult.stderr.trim() && (
                                      <div className="mt-3">
                                        <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-1">Errors</p>
                                        <pre className="bg-red-900/10 text-red-600 rounded-xl p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                                          {runResult.stderr}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 text-sm">📝</div>
                                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-foreground opacity-80">Write Answer</h4>
                              </div>
                              {savedAt[qid] && <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Auto-Synced @ {savedAt[qid]}</span>}
                            </div>
                            
                            <div className="relative p-1 rounded-[2.5rem] bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5 shadow-2xl focus-within:ring-2 ring-indigo-500/20 transition-all duration-300">
                              <textarea
                                value={draft}
                                onChange={e => setDraftAnswers(p => ({ ...p, [qid]: e.target.value }))}
                                disabled={isSub}
                                rows={12}
                                placeholder="Type your answer here..."
                                className="w-full bg-transparent border-none focus:ring-0 p-10 text-lg font-medium leading-relaxed resize-none custom-scrollbar text-foreground placeholder-muted-foreground/30"
                              />
                            </div>

                            {!isSub && (
                              <div className="flex justify-end pt-4">
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => saveAnswer(qid)} disabled={saving === qid || !draft?.trim()} className="px-12 py-5 bg-foreground text-background font-black rounded-2xl text-[11px] uppercase tracking-[0.25em] shadow-2xl transition-all hover:bg-slate-800 dark:hover:bg-slate-200 flex items-center gap-3">
                                  {saving === qid ? (
                                    <><div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /> Saving...</>
                                  ) : (
                                    <><span className="text-lg">💾</span> Save Answer</>
                                  )}
                                </motion.button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <footer className="pt-16 border-t border-gray-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-8">
                        <div className="flex gap-4">
                          <button onClick={() => setActiveQ(i => i - 1)} disabled={activeQ === 0} className="px-10 py-4 rounded-2xl border-2 border-gray-200 dark:border-white/10 font-black text-[11px] uppercase tracking-widest bg-white dark:bg-slate-900/50 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all disabled:opacity-20 shadow-sm flex items-center gap-2">← Previous</button>
                          <button onClick={() => setActiveQ(i => i + 1)} disabled={activeQ === questions.length - 1} className="px-10 py-4 rounded-2xl border-2 border-gray-200 dark:border-white/10 font-black text-[11px] uppercase tracking-widest bg-white dark:bg-slate-900/50 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all disabled:opacity-20 shadow-sm flex items-center gap-2">Next Question →</button>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-40 italic">Your work is saved automatically.</p>
                      </footer>
                    </div>
                  );
                })()}
              </motion.div>
            ) : (
              <motion.div key="leaderboard" initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", damping: 25 }} className="w-full max-w-5xl space-y-12">
                <header className="text-center space-y-4">
                  <div className="inline-block px-5 py-2 bg-indigo-500/10 text-indigo-500 rounded-full font-black text-[10px] uppercase tracking-[0.3em] mb-4">Live Leaderboard</div>
                  <h2 className="text-5xl font-black tracking-tight italic text-foreground">Top Scores</h2>
                  <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs opacity-60">Scores update in real-time.</p>
                </header>
                <div className="glass-premium rounded-[3rem] overflow-hidden border border-gray-200 dark:border-white/5 shadow-2xl relative">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />
                  <table className="w-full text-left border-collapse relative z-10">
                    <thead>
                      <tr className="bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5">
                        <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Rank</th>
                        <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Student</th>
                        <th className="px-10 py-8 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 text-right">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {leaderboard.map((s, i) => (
                        <tr key={i} className={`transition-all duration-300 hover:bg-white/5 group ${s.name === currentUser ? 'bg-indigo-500/5 dark:bg-indigo-500/10' : ''}`}>
                          <td className="px-10 py-7">
                            <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-transform group-hover:scale-110 ${i === 0 ? 'bg-amber-400 text-black shadow-lg shadow-amber-500/20' : i === 1 ? 'bg-slate-300 text-black shadow-lg shadow-slate-500/20' : i === 2 ? 'bg-amber-700 text-white shadow-lg shadow-amber-800/20' : 'bg-gray-100 dark:bg-slate-800 text-slate-500 group-hover:bg-indigo-500 group-hover:text-white'}`}>{i + 1}</span>
                          </td>
                          <td className="px-10 py-7">
                            <div className="flex items-center gap-4">
                              <span className="font-black text-lg text-foreground tracking-tight group-hover:translate-x-1 transition-transform">{s.name as string}</span>
                              {s.name === currentUser && <span className="text-[9px] font-black bg-indigo-500 text-white px-3 py-1 rounded-lg uppercase tracking-widest shadow-lg shadow-indigo-500/20">You</span>}
                            </div>
                          </td>
                          <td className="px-10 py-7 font-black text-right text-xl text-indigo-600 dark:text-indigo-400 tabular-nums tracking-tighter group-hover:scale-105 transition-transform">{s.score as number}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
