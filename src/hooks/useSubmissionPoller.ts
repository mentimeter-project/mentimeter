import { useState, useRef, useCallback, useEffect } from 'react';

export type PollingStatus = 'idle' | 'queued' | 'running' | 'completed' | 'error';

export interface PollResult {
  status: PollingStatus;
  data?: any;
  error?: string;
}

export function useSubmissionPoller(
  onComplete?: (questionId: number, data: any) => void,
  onError?: (questionId: number, error: string) => void
) {
  const [polls, setPolls] = useState<Record<number, PollResult>>({});
  const intervalsRef = useRef<Record<number, NodeJS.Timeout>>({});
  
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  const startPolling = useCallback((questionId: number, logId: number) => {
    setPolls(prev => ({ ...prev, [questionId]: { status: 'queued' } }));

    if (intervalsRef.current[questionId]) {
      clearInterval(intervalsRef.current[questionId]);
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/student/submission-status?logId=${logId}`);
        const text = await res.text();
        console.log(`[Poller] Poll logId=${logId} raw:`, text);
        
        if (!text || text.trim() === "") {
           throw new Error("Empty response from status API");
        }

        let data: any;
        try {
          data = JSON.parse(text);
        } catch (err) {
          console.error(`[Poller] Invalid JSON for logId=${logId}:`, text);
          throw new Error("Invalid response structure from status API");
        }

        if (data.status === 'completed') {
          setPolls(prev => ({
            ...prev,
            [questionId]: {
              status: 'completed',
              data: data.data,
            }
          }));
          if (onCompleteRef.current) onCompleteRef.current(questionId, data.data);
          clearInterval(intervalsRef.current[questionId]);
          delete intervalsRef.current[questionId];
        } else if (data.status === 'error') {
          setPolls(prev => ({
            ...prev,
            [questionId]: {
              status: 'error',
              error: data.error || 'Execution failed.',
            }
          }));
          if (onErrorRef.current) onErrorRef.current(questionId, data.error || 'Execution failed.');
          clearInterval(intervalsRef.current[questionId]);
          delete intervalsRef.current[questionId];
        } else if (data.status === 'queued' || data.status === 'running') {
          setPolls(prev => ({
            ...prev,
            [questionId]: {
               status: data.status,
            }
          }));
        }
      } catch (err) {
        setPolls(prev => ({
          ...prev,
          [questionId]: {
            status: 'error',
            error: 'Network error while checking status.'
          }
        }));
        if (onErrorRef.current) onErrorRef.current(questionId, 'Network error while checking status.');
        clearInterval(intervalsRef.current[questionId]);
        delete intervalsRef.current[questionId];
      }
    };

    // run initially
    poll();
    intervalsRef.current[questionId] = setInterval(poll, 1500);
  }, []);

  const clearPoll = useCallback((questionId: number) => {
    setPolls(prev => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    if (intervalsRef.current[questionId]) {
      clearInterval(intervalsRef.current[questionId]);
      delete intervalsRef.current[questionId];
    }
  }, []);

  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(intervalsRef.current).forEach(clearInterval);
    };
  }, []);

  return { polls, startPolling, clearPoll };
}
