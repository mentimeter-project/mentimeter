'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { LANGUAGES, type Language } from '@/components/CodeEditor';
import EvalResultCard, { EvalResultSkeleton } from '@/components/EvalResultCard';

const CodeEditor = dynamic(() => import('@/components/CodeEditor'), { ssr: false });

type Tab = 'questions' | 'leaderboard';

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
  const [evaluating, setEvaluating] = useState<number | null>(null);
  const [evalResults, setEvalResults] = useState<Record<number, any>>({});
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
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const tabSwitchRef = useRef(0);

  const fetchAssessment = useCallback(async () => {
    const res = await fetch('/api/student/active-assessment');
    const data = await res.json();
    setAssessment(data.assessment || null);
    setQuestions(data.questions || []);
    setAnsweredMap(data.answeredMap || {});
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
        return;
      }
      setEvalResults(prev => ({ ...prev, [questionId]: data }));
      if (!data.error) {
        setAnsweredMap(prev => ({ ...prev, [questionId]: { answer_text: draft.code, marks_awarded: data.score, reviewed: 1 } }));
        setSavedAt(prev => ({ ...prev, [questionId]: new Date().toLocaleTimeString() }));
      }
    } catch {
      setEvalResults(prev => ({ ...prev, [questionId]: { error: 'Network error. Please try again.' } }));
    } finally {
      setEvaluating(false as any);
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

  // All submitted screen
  if (allSubmitted) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-12 text-center max-w-md">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Assessment Submitted!</h2>
          <p className="text-slate-400 text-sm mb-6">Your answers have been submitted successfully. Your teacher will review them shortly.</p>
          {myRank > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
              <p className="text-indigo-600 font-semibold">Current Rank: #{myRank}</p>
              <p className="text-slate-400 text-sm">{myScore} points so far</p>
            </div>
          )}
          <button onClick={logout} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Submit Assessment?</h3>
            <p className="text-slate-500 text-sm mb-2">
              You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
            </p>
            {answeredCount < questions.length && (
              <p className="text-amber-600 text-sm mb-4">⚠️ {questions.length - answeredCount} question(s) are unanswered.</p>
            )}
            <p className="text-slate-400 text-xs mb-6">Once submitted, you cannot change your answers.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => handleSubmitAll(true)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                Submit All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Nav */}
      <nav className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center flex-shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-xs">M</span>
          </div>
          <span className="font-bold text-slate-800 text-sm">Mentimeter</span>
          {assessment && (
            <span className="text-slate-400 text-xs hidden sm:block">· {assessment.title as string}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Fullscreen button */}
          {!isFullscreen && assessment && (
            <button onClick={requestFullscreen}
              className="text-slate-400 hover:text-slate-600 text-xs font-medium border border-slate-200 px-2.5 py-1 rounded-lg transition-colors">
              ⛶ Fullscreen
            </button>
          )}
          {/* Timer */}
          {timeLeft !== null && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-mono font-bold ${
              isDanger ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse' :
              isWarning ? 'bg-amber-50 text-amber-600 border border-amber-200' :
              'bg-slate-100 text-slate-700 border border-slate-200'
            }`}>
              ⏱ {formatTime(timeLeft)}
            </div>
          )}
          {/* Progress */}
          {assessment && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }} />
              </div>
              <span>{answeredCount}/{questions.length}</span>
            </div>
          )}
          {myRank > 0 && (
            <span className="text-xs text-slate-500 hidden sm:block">
              #{myRank} · <span className="text-indigo-600 font-semibold">{myScore}pts</span>
            </span>
          )}
          <span className="text-slate-500 text-xs hidden sm:block font-medium">{name}</span>
          <button onClick={logout} className="text-slate-400 hover:text-slate-600 text-xs font-medium transition-colors">Logout</button>
        </div>
      </nav>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 flex-shrink-0">
        <div className="flex gap-0">
          {([['questions', '📝 Questions'], ['leaderboard', '🏆 Leaderboard']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all -mb-px ${
                tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'
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
              <div className="text-center">
                <div className="text-6xl mb-4">⏳</div>
                <h2 className="text-xl font-bold text-slate-700 mb-2">Waiting for assessment...</h2>
                <p className="text-slate-400 text-sm">Your teacher will launch one soon. This page refreshes automatically.</p>
              </div>
            </div>
          ) : assessment && (
            <>
              {/* Left Sidebar */}
              <div className="w-60 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
                <div className="p-4 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Progress</p>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }} />
                  </div>
                  <p className="text-xs text-slate-400">{answeredCount} of {questions.length} answered</p>
                </div>
                {/* Legend */}
                <div className="px-4 py-3 border-b border-slate-100 flex gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Answered
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 inline-block" />Not yet
                  </span>
                </div>
                {/* Question List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                  {questions.map((q: any, i: number) => {
                    const isAnswered = !!(answeredMap[q.id as number]?.answer_text || draftAnswers[q.id as number]?.trim());
                    const isActive = i === activeQ;
                    return (
                      <button key={q.id as number} onClick={() => setActiveQ(i)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all flex items-center gap-2.5 ${
                          isActive ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                          isAnswered ? 'text-emerald-700 hover:bg-emerald-50' :
                          'text-slate-500 hover:bg-slate-50'
                        }`}>
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          isAnswered ? 'bg-emerald-500 text-white' :
                          isActive ? 'bg-indigo-600 text-white' :
                          'bg-slate-200 text-slate-500'
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
                <div className="p-3 border-t border-slate-100">
                  <button onClick={() => handleSubmitAll(false)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors shadow-sm shadow-indigo-200">
                    Submit All Answers
                  </button>
                  {tabSwitchCount > 0 && (
                    <p className="text-xs text-red-500 text-center mt-2">
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

                  return (
                    <div className="p-8 max-w-3xl">
                      {/* Question Header */}
                      <div className="flex items-start justify-between gap-4 mb-6">
                        <div>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-indigo-600 text-xs font-bold uppercase tracking-wider">
                              Question {activeQ + 1} of {questions.length}
                            </span>
                            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">
                              {q.max_marks as number} marks
                            </span>
                            {isReviewed && (
                              <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs px-2 py-0.5 rounded-full font-semibold">
                                {marksAwarded as number}/{q.max_marks as number} awarded ✓
                              </span>
                            )}
                            {isSubmitted && !isReviewed && (
                              <span className="bg-amber-50 text-amber-600 border border-amber-200 text-xs px-2 py-0.5 rounded-full font-semibold">
                                Submitted · Pending review
                              </span>
                            )}
                          </div>
                          <h2 className="text-slate-800 text-lg font-semibold leading-relaxed">{q.question_text as string}</h2>
                        </div>
                      </div>

                      {/* Answer Box */}
                      {q.question_type === 'code' ? (
                        // ── Code Question ────────────────────────────────────
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                              Your Code
                            </label>
                            {isSubmitted && (
                              <span className="bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 text-xs px-2.5 py-1 rounded-full font-medium">
                                ✓ Submitted
                              </span>
                            )}
                          </div>

                          <CodeEditor
                            value={codeDrafts[qid]?.code ?? (isSubmitted ? (submitted?.answer_text as string ?? '') : (LANGUAGES[0].boilerplate))}
                            languageId={codeDrafts[qid]?.languageId ?? LANGUAGES[0].id}
                            disabled={isSubmitted}
                            onChange={(code) =>
                              setCodeDrafts(prev => ({ ...prev, [qid]: { ...prev[qid], code, languageId: prev[qid]?.languageId ?? LANGUAGES[0].id } }))
                            }
                            onLanguageChange={(lang: Language) =>
                              setCodeDrafts(prev => ({
                                ...prev,
                                [qid]: {
                                  code: prev[qid]?.code ?? lang.boilerplate,
                                  languageId: lang.id,
                                },
                              }))
                            }
                          />

                          {/* Submit button + status */}
                          {!isSubmitted && (
                            <div className="flex items-center justify-between pt-1">
                              <div className="text-xs text-slate-400">
                                {evaluating === qid && (
                                  <span className="flex items-center gap-1.5 text-indigo-400">
                                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                    </svg>
                                    Evaluating against test cases...
                                  </span>
                                )}
                              </div>
                              <button
                                id={`submit-code-${qid}`}
                                onClick={() => evaluateCode(qid)}
                                disabled={evaluating === qid || !codeDrafts[qid]?.code?.trim()}
                                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-900/40 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {evaluating === qid ? (
                                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Running...</>
                                ) : (
                                  <>▶ Run &amp; Submit</>
                                )}
                              </button>
                            </div>
                          )}

                          {/* Evaluation result card — show skeleton while evaluating, card once done */}
                          {evaluating === qid ? (
                            <EvalResultSkeleton />
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
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            Your Answer
                          </label>
                          <textarea
                            value={draft}
                            onChange={e => setDraftAnswers(prev => ({ ...prev, [qid]: e.target.value }))}
                            disabled={isSubmitted}
                            rows={8}
                            placeholder="Type your answer here..."
                            className={`w-full border rounded-2xl px-5 py-4 text-slate-800 text-sm leading-relaxed focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none ${
                              isSubmitted
                                ? 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          />
                          <div className="flex items-center justify-between">
                            <div>
                              {savedAt[qid] && (
                                <p className="text-xs text-emerald-600">✓ Saved at {savedAt[qid]}</p>
                              )}
                              {!isSubmitted && draft?.trim() && !savedAt[qid] && (
                                <p className="text-xs text-slate-400">Unsaved changes</p>
                              )}
                            </div>
                            {!isSubmitted && (
                              <button onClick={() => saveAnswer(qid)}
                                disabled={saving === qid || !draft?.trim()}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors shadow-sm shadow-indigo-200 disabled:opacity-40">
                                {saving === qid ? 'Saving...' : 'Save Answer'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Navigation */}
                      <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100">
                        {activeQ > 0 && (
                          <button onClick={() => setActiveQ(i => i - 1)}
                            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 rounded-xl text-sm font-medium transition-all">
                            ← Previous
                          </button>
                        )}
                        {activeQ < questions.length - 1 && (
                          <button onClick={() => setActiveQ(i => i + 1)}
                            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 rounded-xl text-sm font-medium transition-all">
                            Next →
                          </button>
                        )}
                        {activeQ === questions.length - 1 && (
                          <button onClick={() => handleSubmitAll(false)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-all">
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
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <div className="max-w-2xl mx-auto">
            {myRank > 0 && (
              <div className="bg-white border border-indigo-200 rounded-2xl p-4 mb-6 flex items-center gap-4 shadow-sm">
                <div className="text-3xl font-black text-indigo-600">#{myRank}</div>
                <div>
                  <p className="font-semibold text-slate-800">Your Rank</p>
                  <p className="text-slate-400 text-sm">{myScore} points earned so far</p>
                </div>
              </div>
            )}
            {!assessment && (
              <div className="text-center py-10 text-slate-400 text-sm">No active assessment.</div>
            )}
            <div className="space-y-2">
              {leaderboard.map((s: any, i: number) => {
                const isMe = s.name === currentUser;
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div key={s.usn as string}
                    className={`bg-white border rounded-2xl p-4 flex items-center gap-4 shadow-sm transition-all ${
                      isMe ? 'border-indigo-300 bg-indigo-50/40' :
                      i === 0 ? 'border-amber-200 bg-amber-50/30' :
                      'border-slate-200'
                    }`}>
                    <div className="w-10 text-center">
                      {i < 3
                        ? <span className="text-xl">{medals[i]}</span>
                        : <span className="text-slate-400 font-bold text-sm">#{i + 1}</span>}
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold text-sm ${isMe ? 'text-indigo-700' : 'text-slate-800'}`}>
                        {s.name as string}{isMe && <span className="text-indigo-400 font-normal text-xs ml-1">(You)</span>}
                      </p>
                      <p className="text-slate-400 text-xs font-mono">{s.usn as string} · {s.answered as number}/{s.total_questions as number} answered</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-indigo-600">{(s.score as number) || 0}</p>
                      <p className="text-slate-400 text-xs">/ {s.total_marks as number} marks</p>
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
