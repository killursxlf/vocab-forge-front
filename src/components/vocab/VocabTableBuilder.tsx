import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  addWordToSet,
  createWordSet,
  deleteWord,
  getWordSetById,
  getWordSets,
  updateWord,
  updateWordSet
} from "@/lib/api";
import { useMutation, useInfiniteQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { Check, Edit3, Eye, Plus, Trash2, X, Search, Filter } from "lucide-react";
import { useMemo, useState, useCallback, memo, useEffect } from "react";

// --- Типы данных ---
export type WordStatus = "NEW" | "LEARNING" | "LEARNED";
export interface ColumnDef { id: string; key: string; name: string; }
export interface Word { id: number; original: string; translation: string; status: WordStatus; createdAt: string; customFields: Record<string, string>; }
export interface WordSet { id: number; title: string; customColumns: ColumnDef[]; words: Word[]; }

interface WordSetPage {
  id: number;
  title: string;
  customColumns: { id: string; key: string; name: string }[];
  words: Word[];
  hasMore: boolean;
  total: number; // Общее количество записей с учетом фильтров
}

interface TempWord {
  tempId: string;
  original: string;
  translation: string;
  status: WordStatus;
  customFields: Record<string, string>;
}

interface SearchFilters {
  search: string;
  status: string;
}

// Экспорт для обратной совместимости
export type Row = Word;

// --- Шаблоны ---
const TEMPLATES: Record<string, ColumnDef[]> = {
  basic: [
    { id: "original", key: "original", name: "Слово" },
    { id: "translation", key: "translation", name: "Перевод" },
    { id: "example", key: "example", name: "Пример" },
  ],
  minimal: [
    { id: "original", key: "original", name: "Слово" },
    { id: "translation", key: "translation", name: "Перевод" },
  ],
};

// Компонент для статуса (мемоизированный)
const StatusBadge = memo(({ status }: { status: WordStatus }) => {
  const colors = {
    NEW: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
    LEARNING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
    LEARNED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800'
  };
  
  const icons = {
    NEW: '🆕',
    LEARNING: '📚',
    LEARNED: '✅'
  };
  
  const labels = {
    NEW: 'Новое',
    LEARNING: 'Изучаем',
    LEARNED: 'Выучено'
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${colors[status]}`}>
      <span className="text-[10px]">{icons[status]}</span>
      {labels[status]}
    </span>
  );
});

// Мемоизированная строка таблицы для обычных слов
const WordRow = memo(({ 
  word, 
  index, 
  columns, 
  isEditMode, 
  onUpdateCell, 
  onUpdateStatus, 
  onRemove 
}: {
  word: Word;
  index: number;
  columns: ColumnDef[];
  isEditMode: boolean;
  onUpdateCell: (wordId: number, key: string, value: string) => void;
  onUpdateStatus: (wordId: number, status: WordStatus) => void;
  onRemove: (wordId: number) => void;
}) => {
  const handleCellBlur = useCallback((key: string, value: string) => {
    onUpdateCell(word.id, key, value);
  }, [word.id, onUpdateCell]);

  const handleStatusChange = useCallback((status: string) => {
    onUpdateStatus(word.id, status as WordStatus);
  }, [word.id, onUpdateStatus]);

  const handleRemove = useCallback(() => {
    onRemove(word.id);
  }, [word.id, onRemove]);

  return (
    <tr className={`border-b transition-colors ${
      isEditMode ? 'hover:bg-muted/30' : 'hover:bg-muted/20'
    } ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
      <td className="px-4 py-3">
        {isEditMode ? (
          <Input 
            defaultValue={word.original} 
            onBlur={e => handleCellBlur('original', e.target.value)}
            className="min-w-[120px]"
          />
        ) : (
          <span className="font-medium text-foreground">{word.original}</span>
        )}
      </td>
      <td className="px-4 py-3">
        {isEditMode ? (
          <Input 
            defaultValue={word.translation} 
            onBlur={e => handleCellBlur('translation', e.target.value)}
            className="min-w-[120px]"
          />
        ) : (
          <span className="text-muted-foreground">{word.translation}</span>
        )}
      </td>
      {columns.map(column => (
        <td key={column.key} className="px-4 py-3">
          {isEditMode ? (
            <Input 
              defaultValue={word.customFields?.[column.key] ?? ""} 
              onBlur={e => handleCellBlur(column.key, e.target.value)}
              className="min-w-[100px]"
            />
          ) : (
            <span className="text-sm text-muted-foreground">
              {word.customFields?.[column.key] || '—'}
            </span>
          )}
        </td>
      ))}
      <td className="px-4 py-3">
        {isEditMode ? (
          <Select value={word.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NEW">Новое</SelectItem>
              <SelectItem value="LEARNING">Изучаем</SelectItem>
              <SelectItem value="LEARNED">Выучено</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <StatusBadge status={word.status} />
        )}
      </td>
      {isEditMode && (
        <td className="px-4 py-3">
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={handleRemove}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </td>
      )}
    </tr>
  );
});

// Мемоизированная строка для временных слов
const TempWordRow = memo(({
  tempWord,
  columns,
  onUpdate,
  onSave,
  onRemove,
  isSaving
}: {
  tempWord: TempWord;
  columns: ColumnDef[];
  onUpdate: (tempId: string, key: string, value: string) => void;
  onSave: (tempId: string) => void;
  onRemove: (tempId: string) => void;
  isSaving: boolean;
}) => {
  const handleUpdate = useCallback((key: string, value: string) => {
    onUpdate(tempWord.tempId, key, value);
  }, [tempWord.tempId, onUpdate]);

  const handleSave = useCallback(() => {
    onSave(tempWord.tempId);
  }, [tempWord.tempId, onSave]);

  const handleRemove = useCallback(() => {
    onRemove(tempWord.tempId);
  }, [tempWord.tempId, onRemove]);

  return (
    <tr className="border-b bg-primary/5 border-primary/20">
      <td className="px-4 py-3">
        <Input 
          value={tempWord.original} 
          onChange={e => handleUpdate('original', e.target.value)}
          placeholder="Введите слово"
          className="border-primary/30 focus:border-primary"
        />
      </td>
      <td className="px-4 py-3">
        <Input 
          value={tempWord.translation} 
          onChange={e => handleUpdate('translation', e.target.value)}
          placeholder="Введите перевод"
          className="border-primary/30 focus:border-primary"
        />
      </td>
      {columns.map(column => (
        <td key={column.key} className="px-4 py-3">
          <Input 
            value={tempWord.customFields?.[column.key] ?? ""} 
            onChange={e => handleUpdate(column.key, e.target.value)}
            className="border-primary/30 focus:border-primary"
          />
        </td>
      ))}
      <td className="px-4 py-3">
        <Select 
          value={tempWord.status} 
          onValueChange={(v) => handleUpdate('status', v)}
        >
          <SelectTrigger className="w-[130px] border-primary/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NEW">Новое</SelectItem>
            <SelectItem value="LEARNING">Изучаем</SelectItem>
            <SelectItem value="LEARNED">Выучено</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <Button 
            size="sm"
            variant="ghost" 
            onClick={handleSave}
            disabled={isSaving}
            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/20"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button 
            size="sm"
            variant="ghost" 
            onClick={handleRemove}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
});

export default function VocabTableBuilder() {
  const queryClient = useQueryClient();
  
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [newColName, setNewColName] = useState("");
  const [newSetName, setNewSetName] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  const [tempWords, setTempWords] = useState<TempWord[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 1000); 

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: allSets, isLoading: isLoadingSets } = useQuery({
    queryKey: ["wordSets"],
    queryFn: getWordSets,
  });

  const LIMIT = 50;

  const getWordSetWithFilters = useCallback(
    (setId: number, offset: number, limit: number, filters: SearchFilters) => {
      const params = new URLSearchParams();
      params.append('offset', offset.toString());
      params.append('limit', limit.toString());
      
      if (filters.search) {
        params.append('search', filters.search);
      }
      
      if (filters.status && filters.status !== 'all') {
        params.append('status', filters.status);
      }

      return getWordSetById(setId, params.toString());
    },
    []
  );

  const {
    data: selectedSetPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingSelectedSet,
    refetch: refetchSelectedSet
  } = useInfiniteQuery({
    queryKey: ["wordSet", selectedSetId, debouncedSearch, statusFilter],
    queryFn: ({ pageParam = 0 }) => {
      if (!selectedSetId) throw new Error("No set selected");
      return getWordSetWithFilters(selectedSetId, pageParam as number, LIMIT, {
        search: debouncedSearch,
        status: statusFilter
      });
    },
    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.flatMap(p => p.words).length;
      return lastPage.hasMore ? totalLoaded : undefined;
    },
    initialPageParam: 0,
    enabled: !!selectedSetId,
    staleTime: 30000,
  });

  const selectedSet = useMemo(() => selectedSetPages?.pages[0] ?? null, [selectedSetPages]);
  const allWords = useMemo(() => selectedSetPages?.pages.flatMap(p => p.words) ?? [], [selectedSetPages]);
  const columns = useMemo(() => selectedSet?.customColumns ?? [], [selectedSet]);
  const totalWords = useMemo(() => selectedSet?.total ?? 0, [selectedSet]);

  const createSetMutation = useMutation({ 
    mutationFn: createWordSet, 
    onSuccess: (newSet) => { 
      queryClient.invalidateQueries({ queryKey: ['wordSets'] }); 
      setSelectedSetId(newSet.id); 
    } 
  });
  
  const updateSetMutation = useMutation({ 
    mutationFn: updateWordSet, 
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wordSet", selectedSetId] });
    }
  });
  
  const addWordMutation = useMutation({ 
    mutationFn: addWordToSet, 
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wordSet", selectedSetId] });
      refetchSelectedSet();
    }
  });
  
  const updateWordMutation = useMutation({ 
    mutationFn: updateWord,
    onMutate: async ({ wordId, updatedData }) => {
      await queryClient.cancelQueries({ queryKey: ["wordSet", selectedSetId] });
      
      const previousData = queryClient.getQueryData(["wordSet", selectedSetId]);
      
      queryClient.setQueryData(["wordSet", selectedSetId], (old: any) => {
        if (!old) return old;
        
        return {
          ...old,
          pages: old.pages.map((page: WordSetPage) => ({
            ...page,
            words: page.words.map((word: Word) => 
              word.id === wordId 
                ? { ...word, ...updatedData }
                : word
            )
          }))
        };
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["wordSet", selectedSetId], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["wordSet", selectedSetId] });
    }
  });
  
  const deleteWordMutation = useMutation({ 
    mutationFn: deleteWord,
    onMutate: async (wordId) => {
      await queryClient.cancelQueries({ queryKey: ["wordSet", selectedSetId] });
      
      const previousData = queryClient.getQueryData(["wordSet", selectedSetId]);
      
      queryClient.setQueryData(["wordSet", selectedSetId], (old: any) => {
        if (!old) return old;
        
        return {
          ...old,
          pages: old.pages.map((page: WordSetPage) => ({
            ...page,
            words: page.words.filter((word: Word) => word.id !== wordId),
            total: page.total - 1
          }))
        };
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["wordSet", selectedSetId], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["wordSet", selectedSetId] });
      refetchSelectedSet();
    }
  });
  
  const handleCreateSet = useCallback(() => { 
    if (!newSetName.trim()) return; 
    createSetMutation.mutate({ title: newSetName, customColumns: TEMPLATES.minimal }); 
    setNewSetName(""); 
  }, [newSetName, createSetMutation]);

  const addTempRow = useCallback(() => {
    if (!selectedSetId) return;
    
    const newTempWord: TempWord = {
      tempId: `temp-${Date.now()}`,
      original: "",
      translation: "",
      status: "NEW",
      customFields: {}
    };
    
    setTempWords(prev => [...prev, newTempWord]);
  }, [selectedSetId]);

  const saveTempWord = useCallback(async (tempId: string) => {
    const tempWord = tempWords.find(w => w.tempId === tempId);
    if (!tempWord || !selectedSetId) return;

    if (!tempWord.original.trim() || !tempWord.translation.trim()) {
      alert("Заполните обязательные поля: слово и перевод");
      return;
    }

    try {
      await addWordMutation.mutateAsync({
        setId: selectedSetId,
        newWordData: {
          original: tempWord.original,
          translation: tempWord.translation,
          status: tempWord.status,
          customFields: tempWord.customFields
        }
      });

      setTempWords(prev => prev.filter(w => w.tempId !== tempId));
    } catch (error) {
      console.error("Ошибка при сохранении слова:", error);
    }
  }, [tempWords, selectedSetId, addWordMutation]);

  const removeTempWord = useCallback((tempId: string) => {
    setTempWords(prev => prev.filter(w => w.tempId !== tempId));
  }, []);

  const updateTempWord = useCallback((tempId: string, key: string, value: string) => {
    setTempWords(prev => prev.map(word => {
      if (word.tempId !== tempId) return word;
      
      if (key === 'original' || key === 'translation' || key === 'status') {
        return { ...word, [key]: value };
      } else {
        return { ...word, customFields: { ...word.customFields, [key]: value } };
      }
    }));
  }, []);

  const updateCellOnBlur = useCallback((wordId: number, key: string, value: string) => { 
    const row = allWords.find(r => r.id === wordId); 
    if (!row) return; 
    
    const currentValue = key === 'original' || key === 'translation' 
      ? row[key as keyof Word] 
      : row.customFields?.[key] || "";
    
    if (currentValue === value) return;
    
    const isFixed = key === 'original' || key === 'translation'; 
    const updatedData = isFixed ? { [key]: value } : { customFields: { ...row.customFields, [key]: value } }; 
    updateWordMutation.mutate({ wordId, updatedData }); 
  }, [allWords, updateWordMutation]);
  
  const updateStatus = useCallback((wordId: number, status: WordStatus) => { 
    updateWordMutation.mutate({ wordId, updatedData: { status } }); 
  }, [updateWordMutation]);

  const removeRow = useCallback((wordId: number) => {
    deleteWordMutation.mutate(wordId);
  }, [deleteWordMutation]);

  const handleSetChange = useCallback((value: string) => {
    setSelectedSetId(Number(value));
    setTempWords([]);
    // Сбрасываем фильтры при смене набора
    setSearchQuery("");
    setStatusFilter("all");
    setDebouncedSearch("");
  }, []);

  const addColumn = useCallback(() => { 
    if (!selectedSet || !newColName.trim()) return; 
    const key = newColName.toLowerCase().replace(/\s+/g, "_"); 
    if (selectedSet.customColumns.some(c => c.key === key)) return; 
    updateSetMutation.mutate({ 
      setId: selectedSet.id, 
      updatedData: { 
        customColumns: [...selectedSet.customColumns, { id: key, key, name: newColName }] 
      } 
    }); 
    setNewColName(""); 
  }, [selectedSet, newColName, updateSetMutation]);
  
  const removeColumn = useCallback((keyToRemove: string) => { 
    if (!selectedSet) return; 
    const newColumns = selectedSet.customColumns.filter(c => c.key !== keyToRemove); 
    updateSetMutation.mutate({ 
      setId: selectedSet.id, 
      updatedData: { customColumns: newColumns } 
    }); 
  }, [selectedSet, updateSetMutation]);

  // Очистка фильтров
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setStatusFilter("all");
    setDebouncedSearch("");
  }, []);

  if (isLoadingSets) return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>Загрузка...</CardTitle>
      </CardHeader>
    </Card>
  );

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">
              {selectedSet ? selectedSet.title : "Конструктор таблицы"}
            </CardTitle>
            <CardDescription className="mt-1">
              Выберите набор для редактирования или создайте новый
            </CardDescription>
          </div>
          
          {selectedSet && (
            <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg border">
              <Eye className={`h-4 w-4 transition-colors ${!isEditMode ? 'text-primary' : 'text-muted-foreground'}`} />
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted transition-colors hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 data-[checked]:bg-primary"
                data-checked={isEditMode}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-background shadow-lg transition-transform ${
                  isEditMode ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
              <Edit3 className={`h-4 w-4 transition-colors ${isEditMode ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Панель управления */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 bg-background/30 border rounded-lg">
          <div className="space-y-3">
            <Select onValueChange={handleSetChange} value={selectedSetId ? String(selectedSetId) : ""}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите набор слов..." />
              </SelectTrigger>
              <SelectContent>
                {allSets?.map((set: WordSet) => (
                  <SelectItem key={set.id} value={String(set.id)}>
                    {set.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2">
            <Input 
              placeholder="Название нового набора..." 
              value={newSetName} 
              onChange={e => setNewSetName(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleCreateSet} 
              disabled={createSetMutation.isPending}
              variant="soft"
            >
              {createSetMutation.isPending ? 'Создание...' : 'Создать'}
            </Button>
          </div>
        </div>
        
        {isLoadingSelectedSet && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-pulse text-muted-foreground">Загрузка таблицы...</div>
          </div>
        )}
        
        {selectedSet && (
          <>
            {/* Панель поиска и фильтров */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gradient-to-r from-background/80 to-background/60 border rounded-lg backdrop-blur-sm">
                {/* Поиск */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Поиск по словам и переводам..." 
                    value={searchQuery} 
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 bg-background/50 border-border/50 focus:bg-background transition-colors"
                  />
                  {searchQuery && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                
                {/* Фильтры */}
                <div className="flex items-center gap-3">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px] bg-background/50 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все статусы</SelectItem>
                      <SelectItem value="NEW">🆕 Новые</SelectItem>
                      <SelectItem value="LEARNING">📚 Изучаем</SelectItem>
                      <SelectItem value="LEARNED">✅ Выучено</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {(searchQuery || statusFilter !== "all") && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={clearFilters}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Очистить
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Информация о результатах */}
              {(searchQuery || statusFilter !== "all") && (
                <div className="flex items-center justify-between px-4 py-2 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <Search className="h-4 w-4 text-primary" />
                    <span className="text-foreground">
                      Показано <span className="font-semibold">{allWords.length}</span> из <span className="font-semibold">{totalWords}</span> записей
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {searchQuery && (
                      <span className="px-2 py-1 bg-background rounded border">
                        Поиск: "{searchQuery}"
                      </span>
                    )}
                    {statusFilter !== "all" && (
                      <span className="px-2 py-1 bg-background rounded border">
                        Статус: {statusFilter === "NEW" ? "Новые" : statusFilter === "LEARNING" ? "Изучаем" : "Выучено"}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Панель управления редактированием */}
            {isEditMode && (
              <div className="flex flex-wrap items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Input 
                    placeholder="Новый столбец..." 
                    value={newColName} 
                    onChange={e => setNewColName(e.target.value)}
                    className="w-48"
                  />
                  <Button variant="outline" onClick={addColumn} size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Столбец
                  </Button>
                </div>
                
                <div className="ml-auto">
                  <Button variant="hero" onClick={addTempRow}>
                    <Plus className="h-4 w-4 mr-1" />
                    Добавить слово
                  </Button>
                </div>
              </div>
            )}

            {/* Таблица */}
            <div className="rounded-lg border bg-background overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <span>Слово</span>
                          <div className="text-xs text-muted-foreground">({allWords.length})</div>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Перевод</th>
                      {columns.map(c => (
                        <th key={c.key} className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <span>{c.name}</span>
                            {isEditMode && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => removeColumn(c.key)}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Статус</th>
                      {isEditMode && (
                        <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Действия</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Существующие сохраненные строки */}
                    {allWords.map((word, index) => (
                      <WordRow
                        key={word.id}
                        word={word}
                        index={index}
                        columns={columns}
                        isEditMode={isEditMode}
                        onUpdateCell={updateCellOnBlur}
                        onUpdateStatus={updateStatus}
                        onRemove={removeRow}
                      />
                    ))}
                    
                    {/* Временные несохраненные строки */}
                    {tempWords.map(tempWord => (
                      <TempWordRow
                        key={tempWord.tempId}
                        tempWord={tempWord}
                        columns={columns}
                        onUpdate={updateTempWord}
                        onSave={saveTempWord}
                        onRemove={removeTempWord}
                        isSaving={addWordMutation.isPending}
                      />
                    ))}
                    
                    {/* Состояние загрузки */}
                    {isFetchingNextPage && (
                      <tr>
                        <td className="px-4 py-4 text-center text-muted-foreground" colSpan={columns.length + (isEditMode ? 4 : 3)}>
                          <div className="flex items-center justify-center gap-2">
                            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                            <span>Загружаем еще данные...</span>
                          </div>
                        </td>
                      </tr>
                    )}
                    
                    {/* Пустое состояние */}
                    {allWords.length === 0 && tempWords.length === 0 && !isLoadingSelectedSet && (
                      <tr>
                        <td className="px-4 py-12 text-center text-muted-foreground" colSpan={columns.length + (isEditMode ? 4 : 3)}>
                          <div className="flex flex-col items-center gap-4">
                            <div className="text-6xl opacity-20">
                              {(searchQuery || statusFilter !== "all") ? "🔍" : "📚"}
                            </div>
                            <div className="space-y-2">
                              <div className="text-lg font-medium">
                                {(searchQuery || statusFilter !== "all") 
                                  ? "Ничего не найдено" 
                                  : "Пока пусто"
                                }
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {(searchQuery || statusFilter !== "all") 
                                  ? "Попробуйте изменить параметры поиска" 
                                  : "Нажмите «Добавить слово», чтобы начать"
                                }
                              </div>
                              {(searchQuery || statusFilter !== "all") && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={clearFilters}
                                  className="mt-2"
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Очистить фильтры
                                </Button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Кнопка загрузки дополнительных данных */}
              {hasNextPage && allWords.length > 0 && (
                <div className="flex justify-center py-6 border-t bg-muted/10">
                  <Button
                    variant="soft"
                    size="lg"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="rounded-full shadow-md hover:shadow-lg transition-all min-w-[200px]"
                  >
                    {isFetchingNextPage ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                        <span>Загрузка...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        <span>Показать ещё ({totalWords - allWords.length} осталось)</span>
                      </div>
                    )}
                  </Button>
                </div>
              )}
              
              {/* Статистика внизу таблицы */}
              {allWords.length > 0 && (
                <div className="px-4 py-3 text-center text-sm text-muted-foreground bg-muted/5 border-t flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <span>Загружено {allWords.length} из {totalWords} записей</span>
                    {hasNextPage && (
                      <span className="text-primary">• Есть еще данные</span>
                    )}
                  </div>
                  
                  {(searchQuery || statusFilter !== "all") && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs">Активные фильтры:</span>
                      <div className="flex gap-1">
                        {searchQuery && (
                          <span className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded border">
                            Поиск
                          </span>
                        )}
                        {statusFilter !== "all" && (
                          <span className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded border">
                            Статус
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
