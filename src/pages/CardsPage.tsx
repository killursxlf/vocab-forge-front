import AppLayout from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WordStatus } from "@/components/vocab/VocabTableBuilder";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { countWords, getCardSettings, getWordSets, updateCardSettings } from "../lib/api";
import { useTranslation } from "react-i18next";


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
    frontKey: "",
    backKey: "",
    hintKey: "none",
    selectedStatuses: ["all"],
    selectedTables: ["all"],
  });
  const [userColumns, setUserColumns] = useState<Array<{ key: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [filteredCount, setFilteredCount] = useState(0);
  const [countLoading, setCountLoading] = useState(false);

  const { data: wordSets, isLoading: wordSetsLoading } = useQuery({
    queryKey: ["wordSets"],
    queryFn: getWordSets,
  });

  const availableColumns = useMemo(() => {
    const base: ColumnDto[] =
      userColumns.length > 0
        ? userColumns
        : [
            { key: "original", name: "Original", labelKey: "cards.setup.columns.original" },
            { key: "translation", name: "Translation", labelKey: "cards.setup.columns.translation" },
          ];

    return base.map((c) => ({ ...c, name: c.labelKey ? (t(c.labelKey) as string) : c.name }));
  }, [userColumns, t]);

  const processApiResponse = useCallback((data: CardSettingsResponse) => {
    const columnsFromApi =
      data.userColumns && data.userColumns.length > 0
        ? data.userColumns
        : [
            { key: "original", name: t("cards.setup.columns.original") as string },
            { key: "translation", name: t("cards.setup.columns.translation") as string },
          ];

    const isHintValid = data.hintKey && columnsFromApi.some((c) => c.key === data.hintKey);
    const newHintKey = isHintValid ? (data.hintKey as string) : "none";

    setUserColumns(columnsFromApi);
    setSettings({
      frontKey: data.frontKey || "original",
      backKey: data.backKey || "translation",
      hintKey: newHintKey,
      selectedStatuses: data.selectedStatuses || ["all"],
      selectedTables: data.selectedTables || ["all"],
    });
  }, [t]);

  const loadColumnsForTables = useCallback(async (selectedTables: string[]) => {
    setIsSaving(true);
    try {
      const response = await updateCardSettings({
        selectedTables,
        hintKey: null,
      });
      processApiResponse(response.data.data);
    } catch (error) {
      console.error("Load columns error:", error);
    } finally {
      setIsSaving(false);
    }
  }, [processApiResponse]);

  const selectedStatusesSet = useMemo(
    () => new Set(settings.selectedStatuses as (WordStatus | "all")[]),
    [settings.selectedStatuses]
  );

  const selectedTablesSet = useMemo(() => {
    const newSet = new Set<string | number>();
    settings.selectedTables.forEach((item) => {
      if (item === "all") {
        newSet.add("all");
      } else {
        const numId = parseInt(item, 10);
        if (!isNaN(numId)) newSet.add(numId);
      }
    });
    return newSet;
  }, [settings.selectedTables]);

  useEffect(() => {
    const loadInitialSettings = async () => {
      setIsLoading(true);
      try {
        const response = await getCardSettings();
        processApiResponse(response.data.data);
      } catch (error) {
        console.error("Initial settings error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialSettings();
  }, [processApiResponse]);

  const saveSettings = useCallback(
    async (partialSettings: Partial<CardSettingsState>) => {
      setIsSaving(true);
      try {
        const fullSettings = {
          ...settings,
          ...partialSettings,
          hintKey:
            partialSettings.hintKey === "none"
              ? null
              : partialSettings.hintKey ?? (settings.hintKey === "none" ? null : settings.hintKey),
        };

        const response = await updateCardSettings(fullSettings);

        if (response.data.data.userColumns) {
          processApiResponse(response.data.data);
        }
      } catch (error) {
        console.error("Save settings error:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [processApiResponse, settings]
  );

  const debouncedSave = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return (newSettings: Partial<CardSettingsState>) => {
      clearTimeout(timeoutId);
      setIsSaving(true);
      timeoutId = setTimeout(() => {
        saveSettings(newSettings);
      }, 800);
    };
  }, [saveSettings]);

  const updateSetting = <K extends keyof CardSettingsState>(key: K, value: CardSettingsState[K]) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      debouncedSave(updated);
      return updated;
    });
  };

  const handleStatusToggle = (status: WordStatus | "all") => {
    let newStatuses: string[];
    const currentStatuses = [...settings.selectedStatuses];

    if (status === "all") {
      newStatuses = currentStatuses.includes("all") ? [] : ["all"];
    } else {
      const filteredStatuses = currentStatuses.filter((s) => s !== "all");
      if (filteredStatuses.includes(status)) {
        newStatuses = filteredStatuses.filter((s) => s !== status);
      } else {
        newStatuses = [...filteredStatuses, status];
      }
    }

    if (newStatuses.length === 0 && status !== "all") {
      newStatuses = ["all"];
    }

    updateSetting("selectedStatuses", newStatuses);
  };

  const handleTableToggle = (tableId: number | "all") => {
    let newTables: string[];
    const currentTables = [...settings.selectedTables];

    if (tableId === "all") {
      newTables = currentTables.includes("all") ? [] : ["all"];
    } else {
      const filteredTables = currentTables.filter((t) => t !== "all");
      const tableIdStr = tableId.toString();
      if (filteredTables.includes(tableIdStr)) {
        newTables = filteredTables.filter((t) => t !== tableIdStr);
      } else {
        newTables = [...filteredTables, tableIdStr];
      }
    }

    if (newTables.length === 0 && tableId !== "all") {
      newTables = ["all"];
    }

    setSettings((prev) => ({
      ...prev,
      selectedTables: newTables,
      hintKey: "none",
    }));

    loadColumnsForTables(newTables);
  };

  const getStatusDisplayText = () => {
    if (selectedStatusesSet.has("all")) return t("cards.setup.statuses.all");
    const statusLabels = Array.from(selectedStatusesSet).map((status) => {
      switch (status) {
        case "NEW":
          return t("cards.setup.statuses.new");
        case "LEARNING":
          return t("cards.setup.statuses.learning");
        case "LEARNED":
          return t("cards.setup.statuses.learned");
        default:
          return status as string;
      }
    });
    return statusLabels.join(", ") || (t("cards.setup.statuses.choose") as string);
  };

  const getTablesDisplayText = () => {
    if (settings.selectedTables.includes("all")) return t("cards.setup.tables.all");
    if (wordSetsLoading || !wordSets) return t("cards.setup.tables.loading");

    const selectedTableIds = settings.selectedTables.map((id) => parseInt(id, 10));
    const tableLabels = selectedTableIds
      .map((id) => wordSets.find((set: WordSet) => set.id === id)?.title)
      .filter(Boolean) as string[];

    return tableLabels.length > 0 ? tableLabels.join(", ") : (t("cards.setup.tables.choose") as string);
  };

  const start = () => {
    const params = new URLSearchParams({
      front: settings.frontKey,
      back: settings.backKey,
      hint: settings.hintKey === "none" ? "" : settings.hintKey,
      status: settings.selectedStatuses.join(","),
      tables: settings.selectedTables.join(","),
    });
    navigate(`/train?${params.toString()}`);
  };

  useEffect(() => {
    if (!settings.frontKey || !settings.backKey || isLoading) {
      setFilteredCount(0);
      return;
    }

    setCountLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const response = await countWords({
          ...settings,
          hintKey: settings.hintKey === "none" ? null : settings.hintKey,
        });
        setFilteredCount(response.data.data.count);
      } catch (error) {
        console.error("Count error:", error);
        setFilteredCount(0);
      } finally {
        setCountLoading(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [settings, isLoading]);

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
            disabled={filteredCount === 0 || isSaving || countLoading}
          >
            {t("cards.setup.button.start")}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
