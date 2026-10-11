import AppLayout from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { countWords, getCardSettings, getTrainingCards } from "@/lib/api";
import { defaultCardSettings, parseCardSettings } from '@/lib/cardSettings';
import { getCardValue } from '@/lib/cards';
import { useAnswerSync, AnswerSyncStatus } from '@/contexts/AnswerSyncContext';
import i18n from '@/i18n';
import { Lightbulb } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface TrainingCard {
  id: number;
  status: "NEW" | "LEARNING" | "LEARNED";
  customFields?: { [key: string]: unknown };
  [key: string]: unknown;
}

export default function Training() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [settings, setSettings] = useState(defaultCardSettings);
  const { frontKey, backKey, hintKey } = settings;

  const [deck, setDeck] = useState<TrainingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [known, setKnown] = useState(0);
  const [unknown, setUnknown] = useState(0);


  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { enqueue, getPendingWordIds, pending, syncing } = useAnswerSync();
  const [totalMatching, setTotalMatching] = useState(0);
  const [nextReviewAt, setNextReviewAt] = useState<string | null>(null);
  const answered = useRef(new Set<number>());
  const lockedUntil = useRef(0);
  const currentCard = deck[index];

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    getCardSettings(controller.signal)
      .then(async response => {
        if (controller.signal.aborted) return;
        const pendingBeforeLoad = getPendingWordIds();
        const loaded = parseCardSettings(response.data.data);
        setSettings(loaded);
        const [cards, summary] = await Promise.all([
          getTrainingCards(controller.signal),
          countWords({ ...loaded, hintKey: loaded.hintKey === 'none' ? null : loaded.hintKey }, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        // Keep the server's due-date order and do not repeat unsynced answers.
        const pendingAfterLoad = getPendingWordIds();
        setDeck(cards.filter(card => !pendingBeforeLoad.has(card.id) && !pendingAfterLoad.has(card.id)).map(card => ({ ...card })));
        setTotalMatching(summary.data.data.total);
        setNextReviewAt(summary.data.data.nextReviewAt);
        setIndex(0);
        setKnown(0);
        setUnknown(0);
        answered.current.clear();
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLoadError(true);
        toast.error(i18n.t("cards.training.toast.loadError"));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt, getPendingWordIds]);

  const answer = (knows: boolean) => {
    if (!currentCard || answered.current.has(currentCard.id) || Date.now() < lockedUntil.current) return;
    try {
      enqueue(currentCard.id, knows);
    } catch {
      toast.error(t('sync.storageError'));
      return;
    }
    answered.current.add(currentCard.id);
    lockedUntil.current = Date.now() + 250;
    if (knows) setKnown(k => k + 1);
    else setUnknown(u => u + 1);
    setIndex(i => i + 1);
  };
  const onKnow = () => answer(true);
  const onDontKnow = () => answer(false);

  if (loading) {
    return (
      <AppLayout>
        <div className="w-full px-4 md:px-6 lg:px-10 py-10 text-center">
          <div className="text-lg text-muted-foreground">{t("cards.training.loading")}</div>
        </div>
      </AppLayout>
    );
  }

  if (loadError) return <AppLayout><div className="p-8" role="alert"><p>{t('cards.training.toast.loadError')}</p><Button onClick={() => setAttempt(a => a + 1)}>{t('auth.profile.retry')}</Button></div></AppLayout>;

  if (!deck.length) {
    return (
      <AppLayout>
        <div className="w-full px-4 md:px-6 lg:px-10 py-10 text-center">
          <h1 className="text-2xl font-bold mb-4">{t(totalMatching > 0 ? "cards.training.caughtUp.title" : "cards.training.empty.title")}</h1>
          <p className="text-muted-foreground mb-6">{t(totalMatching > 0 ? "cards.training.caughtUp.subtitle" : "cards.training.empty.subtitle")}</p>
          {nextReviewAt && <p className="text-muted-foreground mb-6">{t('cards.setup.nextReview', {
            date: new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(nextReviewAt)),
          })}</p>}
          <AnswerSyncStatus />
          <Button onClick={() => navigate("/cards")}>{t("cards.training.empty.backBtn")}</Button>
        </div>
      </AppLayout>
    );
  }

  if (index >= deck.length) {
    return (
      <AppLayout>
        <div className="w-full px-4 md:px-6 lg:px-10 py-10">
          <h1 className="text-3xl font-bold mb-4">{t("cards.training.results.title")}</h1>
          <AnswerSyncStatus showSaved />
          <p className="text-muted-foreground mb-4">{t('cards.setup.reviewSchedule')}</p>
          <div className="text-muted-foreground mb-6">
            {t("cards.training.results.total", { count: deck.length })}
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="p-4 border rounded-lg bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
              <div className="text-sm text-green-800 dark:text-green-200">{t("cards.training.results.know")}</div>
              <div className="text-2xl font-semibold text-green-900 dark:text-green-100">{known}</div>
            </div>
            <div className="p-4 border rounded-lg bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800">
              <div className="text-sm text-red-800 dark:text-red-200">{t("cards.training.results.dontKnow")}</div>
              <div className="text-2xl font-semibold text-red-900 dark:text-red-100">{unknown}</div>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="soft" onClick={() => navigate("/cards")}>
              {t("cards.training.results.backBtn")}
            </Button>
            <Button variant="hero" disabled={pending > 0 || syncing} onClick={() => setAttempt(a => a + 1)}>
              {t("cards.training.results.retryBtn")}
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="w-full px-4 md:px-6 lg:px-10 py-8">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-sm text-muted-foreground">
          <div>{t("cards.training.header.progress", { index: index + 1, total: deck.length })}</div>
          <div>{t("cards.training.header.counters", { know: known, dontKnow: unknown })}</div>
        </div>

        <SwipeCard
          card={currentCard}
          frontKey={frontKey}
          backKey={backKey}
          hintKey={hintKey}
          onSwipeLeft={onKnow}
          onSwipeRight={onDontKnow}
          getCardValue={getCardValue}
          t={t}
        />

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="soft"
            onClick={(e) => {
              e.stopPropagation();
              onKnow();
            }}
          >
            {t("cards.training.actions.knowBtn")}
          </Button>
          <Button
            variant="hero"
            onClick={(e) => {
              e.stopPropagation();
              onDontKnow();
            }}
          >
            {t("cards.training.actions.dontKnowBtn")}
          </Button>
        </div>
        <div className="mt-4 text-center"><Button variant="ghost" onClick={() => navigate('/cards')}>{t('cards.training.empty.backBtn')}</Button></div>
      </div>
    </AppLayout>
  );
}

interface SwipeCardProps {
  card: TrainingCard | null;
  frontKey: string | null;
  backKey: string | null;
  hintKey?: string | null;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  getCardValue: (card: TrainingCard | null, key: string | null | undefined) => string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function SwipeCard({
  card,
  frontKey,
  backKey,
  hintKey,
  onSwipeLeft,
  onSwipeRight,
  getCardValue,
  t,
}: SwipeCardProps) {
  const [showBack, setShowBack] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    setShowBack(false);
    setShowHint(false);
    setDx(0);
  }, [card]);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }
    if (!e.isPrimary || e.button !== 0) return;
    suppressClick.current = false;
    startX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    setDx(e.clientX - startX.current);
  };
  const resetPointer = () => { setDx(0); startX.current = null; };
  const onPointerUp = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    const distance = e.clientX - startX.current;
    suppressClick.current = Math.abs(distance) > 10;
    if (distance < -80) onSwipeLeft();
    else if (distance > 80) onSwipeRight();
    resetPointer();
  };

  const frontText = getCardValue(card, frontKey);
  const backText = getCardValue(card, backKey);
  const hintText = getCardValue(card, hintKey);

  return (
    <div className="max-w-sm mx-auto select-none">
      <div
        className="rounded-3xl border p-8 text-center bg-linear-to-br from-card/90 to-card/70 backdrop-blur-lg shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer min-h-[320px] flex flex-col justify-center relative overflow-hidden"
        style={{
          touchAction: "pan-y",
          transform: `translateX(${dx}px) rotate(${dx / 30}deg)`,
          transition: startX.current !== null ? "none" : "transform 0.2s ease",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { suppressClick.current = true; resetPointer(); }}
        onClick={() => {
          if (suppressClick.current) { suppressClick.current = false; return; }
          setShowBack(v => !v);
        }}
        tabIndex={0}
        onKeyDown={e => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowBack(v => !v); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); onSwipeLeft(); }
          if (e.key === 'ArrowRight') { e.preventDefault(); onSwipeRight(); }
        }}
        role="button"
        aria-label={t("cards.training.aria.flip")}
      >
        <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent pointer-events-none" />

        {hintText && hintText !== "—" && !showBack && (
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-muted/80 hover:bg-muted transition-colors pointer-events-auto z-20"
            onClick={(e) => {
              e.stopPropagation();
              setShowHint(!showHint);
            }}
            aria-label={t("cards.training.aria.showHint")}
          >
            <Lightbulb
              size={16}
              className={`transition-colors ${showHint ? "text-yellow-500" : "text-muted-foreground"}`}
            />
          </button>
        )}

        <div className="relative z-10">
          <div className="text-4xl font-bold mb-4 leading-tight break-words">
            {showBack ? backText : frontText}
          </div>

          {!showBack && hintText && showHint && (
            <div className="mt-4 p-3 bg-muted/50 rounded-xl border border-border/50">
              <div className="text-xs text-muted-foreground mb-1">{t("cards.training.hint.title")}</div>
              <div className="text-sm font-medium text-foreground/80">{hintText}</div>
            </div>
          )}

          <div className="mt-6 text-xs text-muted-foreground">{t("cards.training.help")}</div>
        </div>
      </div>
    </div>
  );
}
