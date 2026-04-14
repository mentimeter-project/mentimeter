'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { LANGUAGES, type Language } from '@/components/CodeEditor';
import EvalResultCard, { EvalResultSkeleton } from '@/components/EvalResultCard';
import { useSubmissionPoller } from '@/hooks/useSubmissionPoller';

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
  if (timeLeft !== null && timeLeft < 300) return '⏰ Time is running low — focus on what you know!';
  return '✨ Take your time, read carefully, and do your best.';
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
  
  const onPollComplete = useCallback((questionId: number, data: any) => {
    setEvalResults(prev => ({ ...prev, [questionId]: data }));
    if (!data.error) {
      setAnsweredMap(prev => ({
        ...prev,
        [questionId]: { answer_text: codeDrafts[questionId]?.code, marks_awarded: data.score, reviewed: 1 }
      }));
      setSavedAt(prev => ({ ...prev, [questionId]: new Date().toLocaleTimeString() }));
    }
    setEvaluating(null);
  }, [codeDrafts]);

  const onPollError = useCallback((questionId: number, error: string) => {
    setEvalResults(prev => ({ ...prev, [questionId]: { error } }));
    setEvaluating(null);
  }, []);

  const { polls, startPolling } = useSubmissionPoller(onPollComplete, onPollError);
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
    document.documentElement.classList.add('transitioning');
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    setDark(isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    setTimeout(() => document.documentElement.classList.remove('transitioning'), 350);
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

  const evaluateCode = async (questionId: number) => {
    const draft = codeDrafts[questionId];
    if (!draft?.code?.trim()) return;
    setEvaluating(questionId);
    try {
      const res = await fetch('/api/student/evaluate-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          languageId: draft.languageId,
          sourceCode: draft.code,
        }),
      });
      const data = await res.json();
      if (data.alreadySubmitted) {
        setEvalResults(prev => ({ ...prev, [questionId]: { error: 'You have already submitted this question.' } }));
        setEvaluating(null);
        return;
      }
      
      if (data.status === 'queued' && data.logId) {
        startPolling(questionId, data.logId);
      } else if (data.error) {
        setEvalResults(prev => ({ ...prev, [questionId]: { error: data.error } }));
        setEvaluating(null);
      } else {
        setEvalResults(prev => ({ ...prev, [questionId]: data }));
        if (!data.error) {
          setAnsweredMap(prev => ({ ...prev, [questionId]: { answer_text: draft.code, marks_awarded: data.score, reviewed: 1 } }));
          setSavedAt(prev => ({ ...prev, [questionId]: new Date().toLocaleTimeString() }));
        }
        setEvaluating(null);
      }
    } catch {
      setEvalResults(prev => ({ ...prev, [questionId]: { error: 'Network error. Please try again.' } }));
      setEvaluating(null);
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
      <div className="h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 flex items-center justify-center animate-fade-in relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-emerald-400/20 to-teal-400/10 dark:from-emerald-600/10 dark:to-teal-600/5 rounded-full blur-3xl" />
        <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl border border-white/30 dark:border-slate-700/50 rounded-2xl shadow-xl shadow-indigo-100/40 dark:shadow-black/20 p-12 text-center max-w-md transition-all animate-slide-up relative z-10">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Well done{firstName ? `, ${firstName}` : ''}!</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">Your assessment has been submitted successfully.</p>
          <p className="text-slate-400 dark:text-slate-500 text-xs mb-6">Your teacher will review your answers shortly. Great effort! 💪</p>
          {myRank > 0 && (
            <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700/50 rounded-xl p-4 mb-6">
              <p className="text-indigo-600 dark:text-indigo-400 font-semibold">Current Rank: #{myRank}</p>
              <p className="text-slate-400 dark:text-slate-500 text-sm">{myScore} points earned</p>
            </div>
          )}
          <button onClick={logout} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-95 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-all hover:scale-[1.02] shadow-lg shadow-indigo-500/25">
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 flex flex-col overflow-hidden animate-fade-in">
      {/* Warning Banner */}
      {showWarningBanner && (
        <div className={`flex-shrink-0 flex items-center justify-between px-6 py-2 text-sm font-medium ${
          tabSwitchCount > 3 ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-900'
        }`}>
          <span>
            {tabSwitchCount > 0
              ? `⚠️ Tab switch detected (${tabSwitchCount} time${tabSwitchCount > 1 ? 's' : ''}). This is being recorded.`
              : '⏱ 5 minutes remaining — save your answers now!'}
          </span>
          <button onClick={() => setShowWarningBanner(false)} className="opacity-70 hover:opacity-100 text-xs ml-4">✕ Dismiss</button>
        </div>
      )}

      {/* Submit Confirm Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl dark:shadow-black/40 p-8 max-w-sm w-full border border-white/50 dark:border-slate-700/50 animate-slide-up">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Submit Assessment?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">
              You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
            </p>
            {answeredCount < questions.length && (
              <p className="text-amber-600 dark:text-amber-400 text-sm mb-4">⚠️ {questions.length - answeredCount} question(s) are unanswered.</p>
            )}
            <p className="text-slate-400 dark:text-slate-500 text-xs mb-6">Once submitted, you cannot change your answers.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold py-2.5 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancel
              </button>
              <button onClick={() => handleSubmitAll(true)}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/25">
                Submit All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Nav */}
      <nav className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-white/30 dark:border-slate-700/40 px-6 py-3 flex justify-between items-center flex-shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-500/20">
            <span className="text-white font-black text-xs">M</span>
          </div>
          <span className="font-bold text-slate-800 dark:text-white text-sm">Mentimeter</span>
          {assessment && (
            <span className="text-slate-400 dark:text-slate-500 text-xs hidden sm:block">· {assessment.title as string}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Dark mode toggle */}
          <button onClick={toggleDark}
            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm hover:scale-110 active:scale-95 transition-all border border-slate-200/50 dark:border-slate-600/50"
            aria-label="Toggle dark mode">
            {dark ? '☀️' : '🌙'}
          </button>
          {/* Fullscreen button */}
          {!isFullscreen && assessment && (
            <button onClick={requestFullscreen}
              className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-600 px-2.5 py-1 rounded-lg transition-colors">
              ⛶ Fullscreen
            </button>
          )}
          {/* Timer */}
          {timeLeft !== null && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-mono font-bold ${
              isDanger ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700/50 animate-pulse' :
              isWarning ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700/50' :
              'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
            }`}>
              ⏱ {formatTime(timeLeft)}
            </div>
          )}
          {/* Progress */}
          {assessment && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="w-20 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }} />
              </div>
              <span>{answeredCount}/{questions.length}</span>
            </div>
          )}
          {myRank > 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              #{myRank} · <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{myScore}pts</span>
            </span>
          )}
          <span className="text-slate-600 dark:text-slate-300 text-xs hidden sm:block font-semibold">
            {firstName ? `Hi, ${firstName}!` : name}
          </span>
          <button onClick={logout} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-xs font-medium transition-colors">Logout</button>
        </div>
      </nav>

      {/* Tabs */}
      <div className="bg-white/70 dark:bg-slate-900/50 backdrop-blur-md border-b border-white/30 dark:border-slate-700/40 px-6 flex-shrink-0">
        <div className="flex gap-0">
          {([['questions', '📝 Questions'], ['leaderboard', '🏆 Leaderboard']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all -mb-px ${
                tab === t ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Questions Tab */}
      {tab === 'questions' && (
        <div className="flex flex-1 overflow-hidden">
          {!loading && !assessment ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center animate-slide-up">
                <div className="text-6xl mb-4">⏳</div>
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">
                  {firstName ? `Hey ${firstName}!` : 'Hey!'} Waiting for assessment...
                </h2>
                <p className="text-slate-400 dark:text-slate-500 text-sm">Your teacher will launch one soon. This page refreshes automatically.</p>
              </div>
            </div>
          ) : assessment && (
            <>
              {/* Left Sidebar */}
              <div className="w-64 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-r border-white/30 dark:border-slate-700/40 flex flex-col flex-shrink-0">
                {/* Greeting + Progress */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    {firstName ? `Go ${firstName}! 🚀` : 'Keep going! 🚀'}
                  </p>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{answeredCount} of {questions.length} answered</p>
                  <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1 italic">{getEncouragement(answeredCount, questions.length, timeLeft)}</p>
                </div>
                {/* Legend */}
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 flex gap-3 text-xs text-slate-400 dark:text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Answered
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 dark:bg-slate-600 inline-block" />Not yet
                  </span>
                </div>
                {/* Question List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                  {questions.map((q: any, i: number) => {
                    const isAnswered = !!(answeredMap[q.id as number]?.answer_text || draftAnswers[q.id as number]?.trim());
                    const isActive = i === activeQ;
                    return (
                      <button key={q.id as number} onClick={() => setActiveQ(i)}
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all flex items-center gap-3 border ${
                          isActive ? 'bg-white dark:bg-slate-800 shadow-lg shadow-indigo-100/60 dark:shadow-black/30 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-700/50 scale-[1.03] z-10 my-0.5' :
                          isAnswered ? 'text-emerald-700 dark:text-emerald-400 hover:bg-white/60 dark:hover:bg-slate-800/50 hover:shadow-sm border-transparent' :
                          'text-slate-600 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-slate-800/30 hover:shadow-sm border-transparent'
                        }`}>
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm ${
                          isAnswered ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white' :
                          isActive ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-indigo-200/50' :
                          'bg-slate-200/70 dark:bg-slate-600/50 text-slate-500 dark:text-slate-400'
                        }`}>
                          {isAnswered ? '✓' : i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">Q{i + 1}</p>
                          <p className="text-xs opacity-60">{q.max_marks as number} marks</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {/* Submit All */}
                <div className="p-3 border-t border-slate-100 dark:border-slate-700/50">
                  <button onClick={() => handleSubmitAll(false)}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-95 text-white text-xs font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-500/25 hover:scale-[1.02]">
                    Submit All Answers
                  </button>
                  {tabSwitchCount > 0 && (
                    <p className="text-xs text-red-500 dark:text-red-400 text-center mt-2">
                      ⚠️ {tabSwitchCount} tab switch{tabSwitchCount > 1 ? 'es' : ''} recorded
                    </p>
                  )}
                </div>
              </div>

              {/* Right — Question Detail */}
              <div className="flex-1 overflow-y-auto">
                {questions[activeQ] && (() => {
                  const q = questions[activeQ];
                  const qid = q.id as number;
                  const submitted = answeredMap[qid];
                  const draft = draftAnswers[qid] ?? (submitted?.answer_text as string) ?? '';
                  const isSubmitted = !!(submitted?.answer_text);
                  const isReviewed = submitted?.reviewed;
                  const marksAwarded = submitted?.marks_awarded;

                  const isEvaluatingQ = evaluating === qid || (polls[qid] && (polls[qid].status === 'queued' || polls[qid].status === 'running'));
                  const evaluatingStatusText = polls[qid]?.status === 'queued' ? 'Queued...' : polls[qid]?.status === 'running' ? 'Running test cases...' : 'Processing submission...';

                  return (
                    <div className="p-8 max-w-3xl animate-fade-in">
                      {/* Question Header */}
                      <div className="flex items-start justify-between gap-4 mb-6">
                        <div>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
                              Question {activeQ + 1} of {questions.length}
                            </span>
                            <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs px-2.5 py-0.5 rounded-full font-medium">
                              {q.max_marks as number} marks
                            </span>
                            {isReviewed && (
                              <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/50 text-xs px-2 py-0.5 rounded-full font-semibold">
                                {marksAwarded as number}/{q.max_marks as number} awarded ✓
                              </span>
                            )}
                            {isSubmitted && !isReviewed && (
                              <span className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700/50 text-xs px-2 py-0.5 rounded-full font-semibold">
                                Submitted · Pending review
                              </span>
                            )}
                          </div>
                          <h2 className="text-slate-800 dark:text-white text-lg font-semibold leading-relaxed">{q.question_text as string}</h2>
                        </div>
                      </div>

                      {/* Answer Box */}
                      {q.question_type === 'code' ? (
                        // ── Code Question ────────────────────────────────────
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                              Your Code
                            </label>
                            {isSubmitted && (
                              <span className="bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 text-xs px-2.5 py-1 rounded-full font-medium">
                                ✓ Submitted
                              </span>
                            )}
                          </div>

                          <CodeEditor
                            value={codeDrafts[qid]?.code ?? (isSubmitted ? (submitted?.answer_text as string ?? '') : getStarterCode(qid, codeDrafts[qid]?.languageId ?? LANGUAGES[0].id))}
                            languageId={codeDrafts[qid]?.languageId ?? LANGUAGES[0].id}
                            disabled={isSubmitted}
                            onChange={(code) =>
                              setCodeDrafts(prev => ({ ...prev, [qid]: { ...prev[qid], code, languageId: prev[qid]?.languageId ?? LANGUAGES[0].id } }))
                            }
                            onLanguageChange={(lang: Language) =>
                              setCodeDrafts(prev => ({
                                ...prev,
                                [qid]: {
                                  code: getStarterCode(qid, lang.id),
                                  languageId: lang.id,
                                },
                              }))
                            }
                          />

                          {/* Submit button + status */}
                          {!isSubmitted && (
                            <div className="flex items-center justify-between pt-1">
                              <div className="text-xs text-slate-400 dark:text-slate-500">
                                {isEvaluatingQ && (
                                  <span className="flex items-center gap-1.5 text-indigo-400">
                                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                    </svg>
                                    {evaluatingStatusText}
                                  </span>
                                )}
                              </div>
                              <button
                                id={`submit-code-${qid}`}
                                onClick={() => evaluateCode(qid)}
                                disabled={isEvaluatingQ || !codeDrafts[qid]?.code?.trim()}
                                className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-95 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02]"
                              >
                                {isEvaluatingQ ? (
                                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Running...</>
                                ) : (
                                  <>▶ Run &amp; Submit</>
                                )}
                              </button>
                            </div>
                          )}

                          {/* Evaluation result card — show skeleton while evaluating, card once done */}
                          {isEvaluatingQ ? (
                            <EvalResultSkeleton statusText={evaluatingStatusText} />
                          ) : evalResults[qid] ? (
                            evalResults[qid].error ? (
                              <div className="bg-red-950/40 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
                                ⚠️ {evalResults[qid].error}
                              </div>
                            ) : (
                              <EvalResultCard
                                result={evalResults[qid]}
                                onDismiss={() => setEvalResults(prev => { const n = { ...prev }; delete n[qid]; return n; })}
                              />
                            )
                          ) : null}
                        </div>
                      ) : (
                        // ── Text Question (original UI) ───────────────────────
                        <div className="space-y-3">
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                            Your Answer
                          </label>
                          <textarea
                            value={draft}
                            onChange={e => setDraftAnswers(prev => ({ ...prev, [qid]: e.target.value }))}
                            disabled={isSubmitted}
                            rows={8}
                            placeholder="Type your answer here..."
                            className={`w-full border rounded-2xl px-6 py-5 text-slate-800 dark:text-white text-base leading-relaxed focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all resize-none ${
                              isSubmitted
                                ? 'bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                                : 'bg-white/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md focus:bg-white dark:focus:bg-slate-800 placeholder-slate-300 dark:placeholder-slate-600'
                            }`}
                          />
                          <div className="flex items-center justify-between">
                            <div>
                              {savedAt[qid] && (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400">✓ Saved at {savedAt[qid]}</p>
                              )}
                              {!isSubmitted && draft?.trim() && !savedAt[qid] && (
                                <p className="text-xs text-slate-400 dark:text-slate-500">Unsaved changes</p>
                              )}
                            </div>
                            {!isSubmitted && (
                              <button onClick={() => saveAnswer(qid)}
                                disabled={saving === qid || !draft?.trim()}
                                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-95 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/25 hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100">
                                {saving === qid ? 'Saving...' : 'Save Answer'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Navigation */}
                      <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100 dark:border-slate-700/50">
                        {activeQ > 0 && (
                          <button onClick={() => setActiveQ(i => i - 1)}
                            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-500 rounded-xl text-sm font-medium transition-all hover:shadow-sm">
                            ← Previous
                          </button>
                        )}
                        {activeQ < questions.length - 1 && (
                          <button onClick={() => setActiveQ(i => i + 1)}
                            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-500 rounded-xl text-sm font-medium transition-all hover:shadow-sm">
                            Next →
                          </button>
                        )}
                        {activeQ === questions.length - 1 && (
                          <button onClick={() => handleSubmitAll(false)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.02]">
                            Submit All ✓
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      )}

      {/* Leaderboard Tab */}
      {tab === 'leaderboard' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {myRank > 0 && (
              <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl border border-indigo-200/50 dark:border-indigo-700/40 rounded-2xl p-5 mb-6 flex items-center gap-4 shadow-lg shadow-indigo-100/40 dark:shadow-black/20 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 dark:from-indigo-500/10 dark:to-purple-500/10 pointer-events-none" />
                <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 relative">#{myRank}</div>
                <div className="relative">
                  <p className="font-bold text-lg text-slate-800 dark:text-white">{firstName ? `${firstName}'s Rank` : 'Your Rank'}</p>
                  <p className="text-slate-400 dark:text-slate-500 text-sm">{myScore} points earned so far</p>
                </div>
              </div>
            )}
            {!assessment && (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">No active assessment.</div>
            )}
            <div className="space-y-2">
              {leaderboard.map((s: any, i: number) => {
                const isMe = s.name === currentUser;
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div key={s.usn as string}
                    className={`border rounded-2xl p-4 flex items-center gap-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg backdrop-blur-lg relative overflow-hidden ${
                      isMe ? 'border-indigo-300/50 dark:border-indigo-600/40 bg-indigo-50/60 dark:bg-indigo-900/20 shadow-indigo-100/40 dark:shadow-indigo-900/30' :
                      i === 0 ? 'border-amber-200/50 dark:border-amber-700/40 bg-gradient-to-r from-amber-50/70 to-white/50 dark:from-amber-900/20 dark:to-slate-800/50 shadow-amber-100/50' :
                      i === 1 ? 'border-slate-300/50 dark:border-slate-600/40 bg-gradient-to-r from-slate-100/70 to-white/50 dark:from-slate-800/50 dark:to-slate-800/30 shadow-sm' :
                      i === 2 ? 'border-orange-200/50 dark:border-orange-700/40 bg-gradient-to-r from-orange-50/70 to-white/50 dark:from-orange-900/20 dark:to-slate-800/50 shadow-sm' :
                      'border-white/40 dark:border-slate-700/40 bg-white/60 dark:bg-slate-800/40 shadow-sm'
                    }`}>
                    {i < 3 && <div className={`absolute inset-0 pointer-events-none ${
                      i === 0 ? 'bg-gradient-to-r from-amber-400/5 to-transparent' :
                      i === 1 ? 'bg-gradient-to-r from-slate-400/5 to-transparent' :
                      'bg-gradient-to-r from-orange-400/5 to-transparent'
                    }`} />}
                    <div className="w-10 text-center relative">
                      {i < 3
                        ? <span className="text-2xl drop-shadow-sm">{medals[i]}</span>
                        : <span className="text-slate-400 dark:text-slate-500 font-bold text-sm">#{i + 1}</span>}
                    </div>
                    <div className="flex-1 relative">
                      <p className={`font-semibold text-sm ${isMe ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200'}`}>
                        {s.name as string}{isMe && <span className="text-indigo-400 dark:text-indigo-500 font-normal text-xs ml-1">(You)</span>}
                      </p>
                      <p className="text-slate-400 dark:text-slate-500 text-xs font-mono">{s.usn as string} · {s.answered as number}/{s.total_questions as number} answered</p>
                    </div>
                    <div className="text-right relative">
                      <p className={`text-xl font-black tabular-nums ${isMe ? 'text-indigo-600 dark:text-indigo-400' : i === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`}>{(s.score as number) || 0}</p>
                      <p className="text-slate-400 dark:text-slate-500 text-xs">/ {s.total_marks as number} marks</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
