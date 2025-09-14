import AppLayout from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { getTrainingCards, submitAnswer } from "@/lib/api";
import { Lightbulb } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface TrainingCard {
  id: number;
  status: "NEW" | "LEARNING" | "LEARNED";
  customFields?: { [key: string]: unknown };
  [key: string]: unknown;
}

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Training() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const q = useQuery();

  const frontKey = q.get("front") || "original";
  const backKey = q.get("back") || "translation";
  const hintKey = q.get("hint");
  const statusParam = q.get("status") || "all";
  const tablesParam = q.get("tables") || "";

  const [deck, setDeck] = useState<TrainingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [known, setKnown] = useState(0);
  const [unknown, setUnknown] = useState(0);

  const [realFrontKey, setRealFrontKey] = useState<string | null>(null);
  const [realBackKey, setRealBackKey] = useState<string | null>(null);
  const [realHintKey, setRealHintKey] = useState<string | null>(null);

  const currentCard = deck[index];

  useEffect(() => {
    setLoading(true);
    getTrainingCards()
      .then((cards) => {
        const shuffledData = cards?.sort(() => Math.random() - 0.5) || [];
        setDeck(shuffledData);

        const findRealKey = (obj: Record<string, unknown> | null, keyToFind: string): string | null => {
          if (!obj || !keyToFind || keyToFind === "none") return null;
          const lowerKey = keyToFind.toLowerCase();

          const mainKey = Object.keys(obj).find((k) => k.toLowerCase() === lowerKey);
          if (mainKey) return mainKey;

          const cf = (obj as TrainingCard).customFields;
          if (cf && typeof cf === "object") {
            const customKey = Object.keys(cf).find((k) => k.toLowerCase() === lowerKey);
            if (customKey) return customKey;
          }
          return null;
        };

        if (shuffledData.length > 0) {
          const firstCard = shuffledData[0];

          setRealFrontKey(findRealKey(firstCard as Record<string, unknown>, frontKey));
          setRealBackKey(findRealKey(firstCard as Record<string, unknown>, backKey));

          let dynamicHintKey: string | null = null;
          if (hintKey !== "none" && firstCard.customFields) {
            const customKeys = Object.keys(firstCard.customFields);
            if (customKeys.length > 0) {
              dynamicHintKey = customKeys[0];
            }
          }
          setRealHintKey(dynamicHintKey);
        } else {
          setRealFrontKey(null);
          setRealBackKey(null);
          setRealHintKey(null);
        }

        setIndex(0);
        setKnown(0);
        setUnknown(0);
      })
      .catch((err) => {
        console.error("Failed to load training cards:", err);
        toast.error(t("cards.training.toast.loadError"));
        setDeck([]);
      })
      .finally(() => setLoading(false));
  }, [frontKey, backKey, hintKey, statusParam, tablesParam, t]);

  const nextCard = () => setIndex((i) => i + 1);

  const getCardValue = (card: TrainingCard | null, key: string | null | undefined): string => {
    if (!card || !key || key === "none") return "—";
    const direct = card[key];
    if (direct !== undefined && direct !== null) return String(direct);
    if (card.customFields && key in card.customFields) {
      const value = card.customFields[key];
      if (value !== undefined && value !== null) return String(value);
    }
    return "—";
  };

  const onKnow = () => {
    if (!currentCard) return;
    setKnown((k) => k + 1);
    toast.success(t("cards.training.toast.know", { text: getCardValue(currentCard, realFrontKey) }));
    submitAnswer(currentCard.id, true).catch(() => toast.error(t("cards.training.toast.submitError")));
    nextCard();
  };

  const onDontKnow = () => {
    if (!currentCard) return;
    setUnknown((u) => u + 1);
    toast.info(t("cards.training.toast.dontKnow", { text: getCardValue(currentCard, realFrontKey) }));
    submitAnswer(currentCard.id, false).catch(() => toast.error(t("cards.training.toast.submitError")));
    nextCard();
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="w-full px-4 md:px-6 lg:px-10 py-10 text-center">
          <div className="text-lg text-muted-foreground">{t("cards.training.loading")}</div>
        </div>
      </AppLayout>
    );
  }

  if (!deck.length) {
    return (
      <AppLayout>
        <div className="w-full px-4 md:px-6 lg:px-10 py-10 text-center">
          <h1 className="text-2xl font-bold mb-4">{t("cards.training.empty.title")}</h1>
          <p className="text-muted-foreground mb-6">{t("cards.training.empty.subtitle")}</p>
          <Button onClick={() => navigate(-1)}>{t("cards.training.empty.backBtn")}</Button>
        </div>
      </AppLayout>
    );
  }

  if (index >= deck.length) {
    return (
      <AppLayout>
        <div className="w-full px-4 md:px-6 lg:px-10 py-10">
          <h1 className="text-3xl font-bold mb-4">{t("cards.training.results.title")}</h1>
          <div className="text-muted-foreground mb-6">
            {t("cards.training.results.total", { count: deck.length })}
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="p-4 border rounded-lg bg-green-50 border-green-200">
              <div className="text-sm text-green-800">{t("cards.training.results.know")}</div>
              <div className="text-2xl font-semibold text-green-900">{known}</div>
            </div>
            <div className="p-4 border rounded-lg bg-red-50 border-red-200">
              <div className="text-sm text-red-800">{t("cards.training.results.dontKnow")}</div>
              <div className="text-2xl font-semibold text-red-900">{unknown}</div>
            </div>
          </div>
          <div className="mt-8 flex gap-3">
            <Button variant="soft" onClick={() => navigate(-1)}>
              {t("cards.training.results.backBtn")}
            </Button>
            <Button variant="hero" onClick={() => window.location.reload()}>
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
        <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
          <div>{t("cards.training.header.progress", { index: index + 1, total: deck.length })}</div>
          <div>{t("cards.training.header.counters", { know: known, dontKnow: unknown })}</div>
        </div>

        <SwipeCard
          card={currentCard}
          frontKey={realFrontKey}
          backKey={realBackKey}
          hintKey={realHintKey}
          onSwipeLeft={onDontKnow}
          onSwipeRight={onKnow}
          getCardValue={getCardValue}
          t={t}
        />

        <div className="mt-6 flex items-center justify-center gap-3">
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

  useEffect(() => {
    setShowBack(false);
    setShowHint(false);
    setDx(0);
  }, [card]);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }
    startX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    setDx(e.clientX - startX.current);
  };
  const onPointerUp = () => {
    if (startX.current === null) return;
    const threshold = 80;
    if (dx < -threshold) onSwipeLeft();
    else if (dx > threshold) onSwipeRight();
    setDx(0);
    startX.current = null;
  };

  const frontText = getCardValue(card, frontKey);
  const backText = getCardValue(card, backKey);
  const hintText = getCardValue(card, hintKey);

  return (
    <div className="max-w-sm mx-auto select-none">
      <div
        className="rounded-3xl border p-8 text-center bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-lg shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer min-h-[320px] flex flex-col justify-center relative overflow-hidden"
        style={{
          transform: `translateX(${dx}px) rotate(${dx / 30}deg)`,
          transition: startX.current !== null ? "none" : "transform 0.2s ease",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={() => {
          if (Math.abs(dx) < 10) setShowBack((v) => !v);
        }}
        role="button"
        aria-label={t("cards.training.aria.flip")}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

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
          <div className="text-4xl font-bold mb-4 leading-tight">
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
