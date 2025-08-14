import AppLayout from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { getTrainingCards, updateWord } from "@/lib/api";
import { Lightbulb } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface TrainingCard {
  id: number;
  status: "NEW" | "LEARNING" | "LEARNED";
  customFields?: { [key: string]: any };
  [key: string]: any;
}

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Training() {
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

        // Эта функция остаётся полезной для frontKey и backKey
        const findRealKey = (obj: any, keyToFind: string): string | null => {
          if (!obj || !keyToFind || keyToFind === "none") return null;
          const lowerKey = keyToFind.toLowerCase();

          const mainKey = Object.keys(obj).find((k) => k.toLowerCase() === lowerKey);
          if (mainKey) return mainKey;

          if (obj.customFields) {
            const customKey = Object.keys(obj.customFields).find((k) => k.toLowerCase() === lowerKey);
            if (customKey) return customKey;
          }
          return null;
        };

        if (shuffledData.length > 0) {
          const firstCard = shuffledData[0];
          
          // Логика для front и back остаётся прежней
          setRealFrontKey(findRealKey(firstCard, frontKey));
          setRealBackKey(findRealKey(firstCard, backKey));

          // --- НАЧАЛО ИЗМЕНЕНИЙ ---
          // Новая логика для определения ключа подсказки.
          // Мы больше не ищем ключ из URL. Вместо этого мы берём первый ключ
          // из объекта `customFields`, если он существует.
          let dynamicHintKey: string | null = null;
          if (hintKey !== "none" && firstCard.customFields) {
            const customKeys = Object.keys(firstCard.customFields);
            if (customKeys.length > 0) {
              // Берём самый первый ключ из кастомных полей
              dynamicHintKey = customKeys[0]; 
            }
          }
          setRealHintKey(dynamicHintKey);
          // --- КОНЕЦ ИЗМЕНЕНИЙ ---

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
        toast.error("Не удалось загрузить карточки для тренировки.");
        setDeck([]);
      })
      .finally(() => setLoading(false));
  }, [frontKey, backKey, hintKey, statusParam, tablesParam]);

  const nextCard = () => setIndex((i) => i + 1);

  const onKnow = () => {
    if (!currentCard) return;
    setKnown((k) => k + 1);
    toast.success(`Знаю: "${getCardValue(currentCard, realFrontKey)}"`);
    updateWord({ wordId: currentCard.id, updatedData: { status: "LEARNED" } });
    nextCard();
  };

  const onDontKnow = () => {
    if (!currentCard) return;
    setUnknown((u) => u + 1);
    toast.info(`Не знаю: "${getCardValue(currentCard, realFrontKey)}"`);
    updateWord({ wordId: currentCard.id, updatedData: { status: "LEARNING" } });
    nextCard();
  };

  const getCardValue = (card: TrainingCard | null, key: string | null | undefined): string => {
    if (!card || !key || key === "none") return "—";
    if (card[key] !== undefined && card[key] !== null) return String(card[key]);
    if (card.customFields && key in card.customFields) {
      const value = card.customFields[key];
      if (value !== undefined && value !== null) return String(value);
    }
    return "—";
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="w-full px-4 md:px-6 lg:px-10 py-10 text-center">
          <div className="text-lg text-muted-foreground">Загрузка карточек...</div>
        </div>
      </AppLayout>
    );
  }

  if (!deck.length) {
    return (
      <AppLayout>
        <div className="w-full px-4 md:px-6 lg:px-10 py-10 text-center">
          <h1 className="text-2xl font-bold mb-4">Нет карточек для тренировки</h1>
          <p className="text-muted-foreground mb-6">Попробуйте изменить фильтры в настройках.</p>
          <Button onClick={() => navigate(-1)}>Назад к настройкам</Button>
        </div>
      </AppLayout>
    );
  }

  if (index >= deck.length) {
    return (
      <AppLayout>
        <div className="w-full px-4 md:px-6 lg:px-10 py-10">
          <h1 className="text-3xl font-bold mb-4">Результаты</h1>
          <div className="text-muted-foreground mb-6">Карточек: {deck.length}</div>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="p-4 border rounded-lg bg-green-50 border-green-200">
              <div className="text-sm text-green-800">Знаю</div>
              <div className="text-2xl font-semibold text-green-900">{known}</div>
            </div>
            <div className="p-4 border rounded-lg bg-red-50 border-red-200">
              <div className="text-sm text-red-800">Не знаю</div>
              <div className="text-2xl font-semibold text-red-900">{unknown}</div>
            </div>
          </div>
          <div className="mt-8 flex gap-3">
            <Button variant="soft" onClick={() => navigate(-1)}>Назад к настройкам</Button>
            <Button variant="hero" onClick={() => window.location.reload()}>Ещё раз</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="w-full px-4 md:px-6 lg:px-10 py-8">
        <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
          <div>Карточка {index + 1} / {deck.length}</div>
          <div>Знаю: {known} • Не знаю: {unknown}</div>
        </div>

        <SwipeCard
          card={currentCard}
          frontKey={realFrontKey}
          backKey={realBackKey}
          hintKey={realHintKey}
          onSwipeLeft={onDontKnow}
          onSwipeRight={onKnow}
          getCardValue={getCardValue}
        />

        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="soft"
            onClick={(e) => {
              e.stopPropagation();
              onKnow();
            }}
          >
            Влево — знаю
          </Button>
          <Button
            variant="hero"
            onClick={(e) => {
              e.stopPropagation();
              onDontKnow();
            }}
          >
            Вправо — не знаю
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
}

function SwipeCard({ card, frontKey, backKey, hintKey, onSwipeLeft, onSwipeRight, getCardValue }: SwipeCardProps) {
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
    if ((e.target as HTMLElement).closest('button')) {
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
        aria-label="Перевернуть карточку"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

        {hintText && hintText !== "—" && !showBack && (
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-muted/80 hover:bg-muted transition-colors pointer-events-auto z-20"
            onClick={(e) => {
              e.stopPropagation();
              setShowHint(!showHint);
            }}
            aria-label="Показать подсказку"
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
              <div className="text-xs text-muted-foreground mb-1">Подсказка:</div>
              <div className="text-sm font-medium text-foreground/80">{hintText}</div>
            </div>
          )}

          <div className="mt-6 text-xs text-muted-foreground">
            Кликните для переворота • Свайп: влево — знаю, вправо — не знаю
          </div>
        </div>
      </div>
    </div>
  );
}
