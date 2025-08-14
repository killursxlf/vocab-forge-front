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
  hintKey: string; // "none" вместо null для удобства в UI
  selectedStatuses: string[];
  selectedTables: string[];
}

interface WordSet {
  id: number;
  title: string;
}

export default function CardsSetup() {
  const navigate = useNavigate();

  const [settings, setSettings] = useState<CardSettingsState>({
    frontKey: '',
    backKey: '',
    hintKey: 'none',
    selectedStatuses: ['all'],
    selectedTables: ['all']
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
    if (userColumns.length > 0) return userColumns;
    return [
      { key: 'original', name: 'Слово' },
      { key: 'translation', name: 'Перевод' }
    ];
  }, [userColumns]);

  // Функция для обработки ответа API и обновления состояния
  const processApiResponse = (data: CardSettingsResponse) => {
    const columnsFromApi = data.userColumns && data.userColumns.length > 0
      ? data.userColumns
      : [
          { key: 'original', name: 'Слово' },
          { key: 'translation', name: 'Перевод' }
        ];

    const isHintValid = data.hintKey && columnsFromApi.some(c => c.key === data.hintKey);
    const newHintKey = isHintValid ? data.hintKey! : 'none';

    setUserColumns(columnsFromApi);
    setSettings({
      frontKey: data.frontKey || 'original',
      backKey: data.backKey || 'translation',
      hintKey: newHintKey,
      selectedStatuses: data.selectedStatuses || ['all'],
      selectedTables: data.selectedTables || ['all'],
    });
  };

  // Загрузка колонок для выбранных таблиц (с сохранением)
  const loadColumnsForTables = useCallback(async (selectedTables: string[]) => {
    setIsSaving(true);
    try {
      // ИЗМЕНЕНИЕ ЗДЕСЬ: Отправляем на сервер сброс hintKey
      // Теперь сервер всегда будет обнулять подсказку при смене таблиц.
      const response = await updateCardSettings({ 
        selectedTables, 
        hintKey: null 
      });
      processApiResponse(response.data.data);
    } catch (error) {
      console.error('Ошибка загрузки колонок для выбранных таблиц:', error);
    } finally {
      setIsSaving(false);
    }
  }, []); // Зависимости не нужны, т.к. мы всегда работаем с переданными `selectedTables`

  const selectedStatusesSet = useMemo(() => new Set(settings.selectedStatuses as (WordStatus | "all")[]), [settings.selectedStatuses]);
  
  // FIX: Ensure the Set has a consistent type of `Set<string | number>` to avoid TypeScript errors.
  const selectedTablesSet = useMemo(() => {
    const newSet = new Set<string | number>();
    settings.selectedTables.forEach(item => {
      if (item === 'all') {
        newSet.add('all');
      } else {
        const numId = parseInt(item, 10);
        if (!isNaN(numId)) {
          newSet.add(numId);
        }
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
        console.error('Ошибка загрузки настроек:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialSettings();
  }, []);

  const saveSettings = useCallback(async (partialSettings: Partial<CardSettingsState>) => {
    setIsSaving(true);
    try {
      const fullSettings = {
        ...settings,
        ...partialSettings,
        hintKey: partialSettings.hintKey === "none" ? null : partialSettings.hintKey ?? (settings.hintKey === "none" ? null : settings.hintKey),
      };
      
      const response = await updateCardSettings(fullSettings);
      
      // Обновляем userColumns из ответа сервера, если они есть
      if (response.data.data.userColumns) {
         processApiResponse(response.data.data);
      }
      
    } catch (error) {
      console.error("Ошибка сохранения настроек:", error);
    } finally {
      setIsSaving(false);
    }
  }, [settings, processApiResponse]);

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
    setSettings(prev => {
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
      const filteredStatuses = currentStatuses.filter(s => s !== "all");
      if (filteredStatuses.includes(status)) {
        newStatuses = filteredStatuses.filter(s => s !== status);
      } else {
        newStatuses = [...filteredStatuses, status];
      }
    }

    if (newStatuses.length === 0 && status !== "all") {
      newStatuses = ["all"];
    }

    updateSetting('selectedStatuses', newStatuses);
  };

  const handleTableToggle = (tableId: number | "all") => {
    let newTables: string[];
    const currentTables = [...settings.selectedTables];

    if (tableId === "all") {
      newTables = currentTables.includes("all") ? [] : ["all"];
    } else {
      const filteredTables = currentTables.filter(t => t !== "all");
      const tableIdStr = tableId.toString();
      if (filteredTables.includes(tableIdStr)) {
        newTables = filteredTables.filter(t => t !== tableIdStr);
      } else {
        newTables = [...filteredTables, tableIdStr];
      }
    }

    if (newTables.length === 0 && tableId !== "all") {
      newTables = ["all"];
    }

    // ИЗМЕНЕНИЕ ЗДЕСЬ: Оптимистично обновляем UI для мгновенного отклика.
    // Сразу сбрасываем hintKey в локальном состоянии.
    setSettings(prev => ({ 
      ...prev, 
      selectedTables: newTables, 
      hintKey: 'none' 
    }));

    // Запускаем сохранение на сервере и обновление колонок
    loadColumnsForTables(newTables);
  };

  const getStatusDisplayText = () => {
    if (selectedStatusesSet.has("all")) return "Все";
    const statusLabels = Array.from(selectedStatusesSet).map(status => {
      switch (status) {
        case "NEW": return "Новые";
        case "LEARNING": return "Изучаем";
        case "LEARNED": return "Выучено";
        default: return status;
      }
    });
    return statusLabels.join(", ") || "Выберите статус";
  };

  const getTablesDisplayText = () => {
    if (settings.selectedTables.includes("all")) return "Все таблицы";
    if (wordSetsLoading || !wordSets) return "Загрузка...";
    
    const selectedTableIds = settings.selectedTables.map(id => parseInt(id, 10));
    const tableLabels = selectedTableIds
      .map(id => wordSets.find((set: WordSet) => set.id === id)?.title)
      .filter(Boolean);
    
    return tableLabels.length > 0 ? tableLabels.join(", ") : "Выберите таблицы";
  };

  const start = () => {
    const params = new URLSearchParams({
      front: settings.frontKey,
      back: settings.backKey,
      hint: settings.hintKey === 'none' ? '' : settings.hintKey,
      status: settings.selectedStatuses.join(','),
      tables: settings.selectedTables.join(',')
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
          hintKey: settings.hintKey === 'none' ? null : settings.hintKey,
        });
        setFilteredCount(response.data.data.count);
      } catch (error) {
        console.error("Ошибка подсчёта слов:", error);
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
            <div className="h-8 bg-gray-300 rounded w-64 mb-6"></div>
            <div className="h-12 bg-gray-300 rounded mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map(i => (
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
          <h1 className="text-3xl md:text-4xl font-bold">Настройка карточек</h1>
          {(isSaving || countLoading) && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
              {isSaving ? "Сохранение..." : "Подсчёт..."}
            </div>
          )}
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Выбор таблиц для тренировки</label>
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
                  <label htmlFor="all-tables" className="text-sm font-medium cursor-pointer">Все таблицы</label>
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
                      <label htmlFor={`table-${set.id}`} className="text-sm cursor-pointer">{set.title}</label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Лицевая сторона</label>
            <Select value={settings.frontKey} onValueChange={value => updateSetting('frontKey', value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableColumns.map(c => <SelectItem key={c.key} value={c.key}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Оборотная сторона</label>
            <Select value={settings.backKey} onValueChange={value => updateSetting('backKey', value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableColumns.map(c => <SelectItem key={c.key} value={c.key}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Подсказка</label>
            <Select
              key={availableColumns.map(c => c.key).join('-')}
              value={settings.hintKey}
              onValueChange={value => updateSetting("hintKey", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Без подсказки">
                  {availableColumns.find(c => c.key === settings.hintKey)?.name || "Без подсказки"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без подсказки</SelectItem>
                {availableColumns.map(c => (
                  <SelectItem key={c.key} value={c.key}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Статусы слов</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {getStatusDisplayText()} <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px]">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox id="status_all" checked={selectedStatusesSet.has("all")} onCheckedChange={() => handleStatusToggle("all")} />
                    <label htmlFor="status_all" className="cursor-pointer select-none">Все</label>
                  </div>
                  {(["NEW", "LEARNING", "LEARNED"] as const).map(status => (
                     <div className="flex items-center gap-2" key={status}>
                       <Checkbox id={`status_${status}`} checked={selectedStatusesSet.has(status)} onCheckedChange={() => handleStatusToggle(status)} disabled={selectedStatusesSet.has("all")} />
                       <label htmlFor={`status_${status}`} className="cursor-pointer select-none">
                         {status === 'NEW' ? 'Новые' : status === 'LEARNING' ? 'Изучаем' : 'Выучено'}
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
            <div className="text-sm text-muted-foreground">Подходит слов</div>
            <div className="text-2xl font-semibold">{countLoading ? (
              <span className="italic text-gray-500">Подсчёт...</span>
            ) : (
              <strong>{filteredCount}</strong>
            )}</div>
          </div>
          <Button variant="hero" size="lg" onClick={start} disabled={filteredCount === 0 || isSaving || countLoading}>Начать тренировку</Button>
        </div>
      </div>
    </AppLayout>
  );
}
