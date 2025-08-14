import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ColumnDef, Row, WordStatus } from "./VocabTableBuilder";

interface Props {
  columns: ColumnDef[];
  rows: Row[];
}

const STATUS_OPTIONS: { value: WordStatus | "all"; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "new", label: "Новые" },
  { value: "learning", label: "Изучаем" },
  { value: "learned", label: "Выучено" },
];

export default function FlashcardPreview({ columns, rows }: Props) {
  const [frontKey, setFrontKey] = useState<string>(() => columns[0]?.key ?? "word");
  const [backKey, setBackKey] = useState<string>(() => columns[1]?.key ?? "translation");
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [statusFilter, setStatusFilter] = useState<WordStatus | "all">("all");

  const filtered = useMemo(() => {
    const list = statusFilter === "all" ? rows : rows.filter(r => r.status === statusFilter);
    return list.filter(r => (r as any)[frontKey] || (r as any)[backKey]);
  }, [rows, statusFilter, frontKey, backKey]);

  const current = filtered[index] as Row | undefined;

  const next = () => {
    setShowBack(false);
    setIndex(i => (i + 1) % Math.max(filtered.length || 1, 1));
  };
  const prev = () => {
    setShowBack(false);
    setIndex(i => (i - 1 + Math.max(filtered.length || 1, 1)) % Math.max(filtered.length || 1, 1));
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>Карточки</CardTitle>
        <CardDescription>Выберите стороны карточки и фильтр по статусу</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-1">
            <Select value={frontKey} onValueChange={setFrontKey}>
              <SelectTrigger>
                <SelectValue placeholder="Лицевая сторона" />
              </SelectTrigger>
              <SelectContent>
                {columns.map(c => (
                  <SelectItem key={c.key} value={c.key}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1">
            <Select value={backKey} onValueChange={setBackKey}>
              <SelectTrigger>
                <SelectValue placeholder="Оборотная сторона" />
              </SelectTrigger>
              <SelectContent>
                {columns.map(c => (
                  <SelectItem key={c.key} value={c.key}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1 flex items-center justify-end gap-2">
            <Button variant="soft" onClick={prev} disabled={!filtered.length}>Назад</Button>
            <Button variant="hero" onClick={() => (showBack ? next() : setShowBack(true))} disabled={!filtered.length}>
              {showBack ? "Дальше" : "Показать ответ"}
            </Button>
          </div>
        </div>

        <div className="mt-2">
          {current ? (
            <Flashcard
              key={current.id}
              front={(current as any)[frontKey] ?? ""}
              back={(current as any)[backKey] ?? ""}
              showBack={showBack}
              onToggle={() => setShowBack(v => !v)}
            />
          ) : (
            <div className="p-8 text-center text-muted-foreground">Нет данных для карточек</div>
          )}
          {filtered.length > 0 && (
            <div className="mt-2 text-center text-sm text-muted-foreground">{index + 1} / {filtered.length}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Flashcard({ front, back, showBack, onToggle }: { front: string; back: string; showBack: boolean; onToggle: () => void }) {
  const [coords, setCoords] = useState({ x: 0.5, y: 0.3 });

  return (
    <div
      className="interactive-spotlight"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        setCoords({ x, y });
        e.currentTarget.style.setProperty("--x", `${Math.round(x * 100)}%`);
        e.currentTarget.style.setProperty("--y", `${Math.round(y * 100)}%`);
      }}
    >
      <div
        className="mx-auto w-full max-w-xl select-none rounded-xl border p-8 text-center shadow-sm bg-card/70 backdrop-blur"
        style={{ transformStyle: "preserve-3d" }}
        onClick={onToggle}
      >
        <div className="text-3xl font-semibold" style={{ transform: "translateZ(20px)" }}>
          {showBack ? back || "—" : front || "—"}
        </div>
        <div className="mt-2 text-sm text-muted-foreground">Кликните для переворота</div>
      </div>
    </div>
  );
}
