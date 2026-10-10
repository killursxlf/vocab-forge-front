import AppLayout from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WordStatus } from "@/components/vocab/VocabTableBuilder";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { countWords, errorMessage, getCardSettings, getWordSets, updateCardSettings } from "../lib/api";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";


interface ColumnDto { key: string; name: string; labelKey?: string }

interface CardSettingsResponse {
  frontKey: string;
  backKey: string;
  hintKey: string | null;
  selectedStatuses: string[];
  selectedTables?: string[];
  userColumns?: Array<{ key: string; name: string }>;
}

interface CardSettingsState {
  frontKey: string;
  backKey: string;
  hintKey: string;
  selectedStatuses: string[];
  selectedTables: string[];
}

interface WordSet {
  id: number;
  title: string;
}

export default function CardsSetup() {
  const { t } = useTranslation();
  const navigate = useNavigate();


  const [settings, setSettings] = useState<CardSettingsState>({
    frontKey: "original", backKey: "translation", hintKey: "none",
    selectedStatuses: ["all"], selectedTables: ["all"],
  });
  const [savedSettings, setSavedSettings] = useState<CardSettingsState | null>(null);
  const [userColumns, setUserColumns] = useState<ColumnDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialError, setInitialError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [countLoading, setCountLoading] = useState(false);
  const [countError, setCountError] = useState(false);
  const [countAttempt, setCountAttempt] = useState(0);
  const latest = useRef(settings);
  latest.current = settings;
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const dirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const isSaving = dirty || writing;

  const { data: wordSets, isLoading: wordSetsLoading, isError: wordSetsError, refetch: reloadSets } = useQuery({
    queryKey: ["wordSets"], queryFn: getWordSets,
  });
  const availableColumns = useMemo(() => [
    { key: "original", name: t("cards.setup.columns.original") },
    { key: "translation", name: t("cards.setup.columns.translation") },
    ...userColumns.filter(c => !["word", "original", "translation"].includes(c.key)),
  ], [userColumns, t]);

  const parseSettings = useCallback((data: CardSettingsResponse): CardSettingsState => ({
    frontKey: data.frontKey === "word" ? "original" : data.frontKey || "original",
    backKey: data.backKey === "word" ? "original" : data.backKey || "translation",
    hintKey: data.hintKey || "none",
    selectedStatuses: data.selectedStatuses ?? ["all"],
    selectedTables: data.selectedTables ?? ["all"],
  }), []);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    getCardSettings(controller.signal).then(response => {
      if (controller.signal.aborted) return;
      const data: CardSettingsResponse = response.data.data;
      const loaded = parseSettings(data);
      setUserColumns(data.userColumns ?? []);
      setSettings(loaded);
      setSavedSettings(loaded);
      setInitialError(false);
      setError(null);
    }).catch(err => {
      if (!controller.signal.aborted) {
        setInitialError(true);
        setError(errorMessage(err, i18n.t('cards.setup.loadError')));
      }
    }).finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => controller.abort();
  }, [attempt, parseSettings]);

  const persist = useCallback(async (snapshot: CardSettingsState) => {
    setWriting(true);
    try {
      const response = await updateCardSettings({ ...snapshot, hintKey: snapshot.hintKey === "none" ? null : snapshot.hintKey });
      if (!mounted.current) return;
      const data: CardSettingsResponse = response.data.data;
      const saved = parseSettings(data);
      setSavedSettings(saved);
      if (JSON.stringify(latest.current) === JSON.stringify(snapshot)) {
        setSettings(saved);
        setUserColumns(data.userColumns ?? []);
      }
      setError(null);
    } catch (err) {
      if (mounted.current) setError(errorMessage(err, i18n.t('cards.setup.saveError')));
    } finally {
      if (mounted.current) setWriting(false);
    }
  }, [parseSettings]);

  useEffect(() => {
    if (isLoading || initialError || writing || error || !dirty) return;
    const timer = setTimeout(() => { void persist(settings); }, 800);
    return () => clearTimeout(timer);
  }, [settings, dirty, writing, error, isLoading, initialError, persist]);

  const updateSetting = <K extends keyof CardSettingsState>(key: K, value: CardSettingsState[K]) => {
    setError(null);
    setSettings(prev => ({ ...prev, [key]: value }));
  };
  const selectedStatusesSet = useMemo(() => new Set(settings.selectedStatuses), [settings.selectedStatuses]);
  const selectedTablesSet = useMemo(() => new Set(settings.selectedTables.map(id => id === "all" ? "all" : Number(id))), [settings.selectedTables]);

  const handleStatusToggle = (status: WordStatus | "all") => {
    const current = settings.selectedStatuses;
    const next = status === "all" ? (current.includes("all") ? [] : ["all"])
      : current.includes(status) ? current.filter(s => s !== status && s !== "all") : [...current.filter(s => s !== "all"), status];
    updateSetting("selectedStatuses", next);
  };
  const handleTableToggle = (id: number | "all") => {
    const current = settings.selectedTables;
    const value = String(id);
    const next = id === "all" ? (current.includes("all") ? [] : ["all"])
      : current.includes(value) ? current.filter(s => s !== value && s !== "all") : [...current.filter(s => s !== "all"), value];
    setError(null);
    setSettings(prev => ({ ...prev, selectedTables: next, hintKey: "none" }));
  };
  const getStatusDisplayText = () => settings.selectedStatuses.includes("all") ? t("cards.setup.statuses.all")
    : settings.selectedStatuses.map(status => t("cards.setup.statuses." + status.toLowerCase())).join(", ") || t("cards.setup.statuses.choose");
  const getTablesDisplayText = () => settings.selectedTables.includes("all") ? t("cards.setup.tables.all")
    : wordSetsLoading ? t("cards.setup.tables.loading")
    : wordSets?.filter(set => settings.selectedTables.includes(String(set.id))).map(set => set.title).join(", ") || t("cards.setup.tables.choose");

  const start = () => {
    if (dirty || writing || error || initialError || countError) return;
    const params = new URLSearchParams({
      front: settings.frontKey, back: settings.backKey, hint: settings.hintKey,
      status: settings.selectedStatuses.join(","), tables: settings.selectedTables.join(","),
    });
    navigate("/train?" + params.toString());
  };

  useEffect(() => {
    const controller = new AbortController();
    if (isLoading || initialError || !settings.selectedStatuses.length || !settings.selectedTables.length) {
      setFilteredCount(0);
      setCountLoading(false);
      return () => controller.abort();
    }
    setCountLoading(true);
    setCountError(false);
    const timer = setTimeout(async () => {
      try {
        const response = await countWords({ ...settings, hintKey: settings.hintKey === "none" ? null : settings.hintKey }, controller.signal);
        if (!controller.signal.aborted) setFilteredCount(response.data.data.count);
      } catch {
        if (!controller.signal.aborted) { setCountError(true); setFilteredCount(0); }
      } finally {
        if (!controller.signal.aborted) setCountLoading(false);
      }
    }, 500);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [settings, isLoading, initialError, countAttempt]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="w-full px-4 md:px-6 lg:px-10 py-8 md:py-12">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-64 mb-6" aria-label={t("cards.setup.skeleton.title") as string}></div>
            <div className="h-12 bg-gray-300 rounded mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-32"></div>
                  <div className="h-10 bg-gray-300 rounded"></div>
                </div>
              ))}
            </div>
            <div className="h-20 bg-gray-300 rounded"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="w-full px-4 md:px-6 lg:px-10 py-8 md:py-12">
        {error && <div role="alert" className="mb-4 text-destructive"><p>{error}</p><Button variant="outline" disabled={writing} onClick={() => { setError(null); if (initialError) setAttempt(a => a + 1); }}>{t('auth.profile.retry')}</Button></div>}
        {countError && <div role="alert" className="mb-4 text-destructive"><p>{t('cards.setup.countError')}</p><Button variant="outline" onClick={() => setCountAttempt(a => a + 1)}>{t('auth.profile.retry')}</Button></div>}
        {wordSetsError && <div role="alert"><p>{t('cards.setup.tablesError')}</p><Button onClick={() => reloadSets()}>{t('auth.profile.retry')}</Button></div>}

        <div className="flex items-center gap-2 mb-6">
          <h1 className="text-3xl md:text-4xl font-bold">{t("cards.setup.title")}</h1>
          {(isSaving || countLoading) && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
              {isSaving ? t("cards.setup.saving") : t("cards.setup.counting")}
            </div>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("cards.setup.tables.label")}
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between h-12 px-4 py-3 text-sm" disabled={wordSetsLoading}>
                <span className="truncate">{getTablesDisplayText()}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-3" align="start">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="all-tables"
                    checked={settings.selectedTables.includes("all")}
                    onCheckedChange={() => handleTableToggle("all")}
                  />
                  <label htmlFor="all-tables" className="text-sm font-medium cursor-pointer">
                    {t("cards.setup.tables.all")}
                  </label>
                </div>
                <div className="border-t pt-2 space-y-2">
                  {wordSets?.map((set: WordSet) => (
                    <div key={set.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`table-${set.id}`}
                        checked={selectedTablesSet.has(set.id)}
                        onCheckedChange={() => handleTableToggle(set.id)}
                        disabled={settings.selectedTables.includes("all")}
                      />
                      <label htmlFor={`table-${set.id}`} className="text-sm cursor-pointer">
                        {set.title}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("cards.setup.sides.front")}
            </label>
            <Select value={settings.frontKey} onValueChange={(value) => updateSetting("frontKey", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableColumns.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("cards.setup.sides.back")}
            </label>
            <Select value={settings.backKey} onValueChange={(value) => updateSetting("backKey", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableColumns.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("cards.setup.sides.hint")}
            </label>
            <Select
              key={availableColumns.map((c) => c.key).join("-")}
              value={settings.hintKey}
              onValueChange={(value) => updateSetting("hintKey", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("cards.setup.sides.noHint") as string}>
                  {availableColumns.find((c) => c.key === settings.hintKey)?.name ||
                    (t("cards.setup.sides.noHint") as string)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("cards.setup.sides.noHint")}</SelectItem>
                {availableColumns.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("cards.setup.statuses.label")}
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {getStatusDisplayText()} <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px]">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="status_all"
                      checked={selectedStatusesSet.has("all")}
                      onCheckedChange={() => handleStatusToggle("all")}
                    />
                    <label htmlFor="status_all" className="cursor-pointer select-none">
                      {t("cards.setup.statuses.all")}
                    </label>
                  </div>
                  {(["NEW", "LEARNING", "LEARNED"] as const).map((status) => (
                    <div className="flex items-center gap-2" key={status}>
                      <Checkbox
                        id={`status_${status}`}
                        checked={selectedStatusesSet.has(status)}
                        onCheckedChange={() => handleStatusToggle(status)}
                        disabled={selectedStatusesSet.has("all")}
                      />
                      <label htmlFor={`status_${status}`} className="cursor-pointer select-none">
                        {status === "NEW"
                          ? t("cards.setup.statuses.new")
                          : status === "LEARNING"
                          ? t("cards.setup.statuses.learning")
                          : t("cards.setup.statuses.learned")}
                      </label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <div className="text-sm text-muted-foreground">{t("cards.setup.match.label")}</div>
            <div className="text-2xl font-semibold">
              {countLoading ? (
                <span className="italic text-gray-500">{t("cards.setup.match.counting")}</span>
              ) : (
                <strong>{filteredCount}</strong>
              )}
            </div>
          </div>
          <Button
            variant="hero"
            size="lg"
            onClick={start}
            disabled={filteredCount === 0 || isSaving || countLoading || !!error || countError || initialError}
          >
            {t("cards.setup.button.start")}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
