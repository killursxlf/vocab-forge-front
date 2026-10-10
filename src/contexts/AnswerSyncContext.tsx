import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';
import { AnswerQueue } from '@/lib/answerQueue';
import { useQueryClient } from '@tanstack/react-query';
import { getProfile, submitAnswer } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface AnswerSyncState {
  pending: number;
  syncing: boolean;
  failed: boolean;
  enqueue: (wordId: number, knows: boolean) => void;
  retry: () => void;
}

const AnswerSyncContext = createContext<AnswerSyncState | null>(null);

export function AnswerSyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const queue = useMemo(() => userId ? new AnswerQueue({
    get length() { return localStorage.length; },
    key: index => localStorage.key(index),
    getItem: key => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
    removeItem: key => localStorage.removeItem(key),
  }, userId) : null, [userId]);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [failed, setFailed] = useState(false);
  const controller = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    try {
      const count = queue?.list().length ?? 0;
      setPending(count);
      if (!count) setFailed(false);
    }
    catch { setFailed(true); }
  }, [queue]);

  const retry = useCallback(async () => {
    if (!queue || !userId || controller.current || !navigator.onLine) return;
    const abort = new AbortController();
    controller.current = abort;
    setSyncing(true);
    try {
      if (!queue.list().length) { setFailed(false); return; }
      const session = await getProfile(abort.signal);
      if (session.data.id !== userId) throw new Error('Account changed');
      await queue.flush(answer => submitAnswer(answer.wordId, answer.knows, answer.id, abort.signal), abort.signal);
      if (!abort.signal.aborted) {
        setFailed(false);
        void queryClient.invalidateQueries({ queryKey: ['wordSet'] });
      }
    } catch {
      if (!abort.signal.aborted) setFailed(true);
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setSyncing(false);
        refresh();
      }
    }
  }, [queue, userId, refresh, queryClient]);

  useEffect(() => {
    setFailed(false);
    setSyncing(false);
    refresh();
    void retry();
    const timer = setInterval(() => { void retry(); }, 30_000);
    const onOnline = () => { void retry(); };
    window.addEventListener('online', onOnline);
    window.addEventListener('storage', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('storage', refresh);
      controller.current?.abort();
      controller.current = null;
    };
  }, [retry, refresh]);

  const enqueue = (wordId: number, knows: boolean) => {
    if (!queue) throw new Error('Not signed in');
    queue.add(wordId, knows);
    refresh();
    void retry();
  };

  return <AnswerSyncContext.Provider value={{ pending, syncing, failed, enqueue, retry }}>{children}</AnswerSyncContext.Provider>;
}

export function useAnswerSync() {
  const context = useContext(AnswerSyncContext);
  if (!context) throw new Error('AnswerSyncProvider is missing');
  return context;
}

export function AnswerSyncStatus({ showSaved = false }: { showSaved?: boolean }) {
  const { pending, syncing, failed, retry } = useAnswerSync();
  const { t } = useTranslation();
  if (!pending && !failed && !showSaved) return null;
  return <div role="status" className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
    <span>{t(failed ? 'sync.failed' : pending ? 'sync.pending' : 'sync.saved', { count: pending })}</span>
    {(pending > 0 || failed) && <Button size="sm" variant="outline" disabled={syncing} onClick={retry}>{t(syncing ? 'sync.sending' : 'sync.retry')}</Button>}
  </div>;
}
