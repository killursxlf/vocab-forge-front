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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Edit3, Eye, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

// --- Типы данных ---
export type WordStatus = "NEW" | "LEARNING" | "LEARNED";
export interface ColumnDef { id: string; key: string; name: string; }
export interface Word { id: number; original: string; translation: string; status: WordStatus; createdAt: string; customFields: Record<string, string>; }
export interface WordSet { id: number; title: string; customColumns: ColumnDef[]; words: Word[]; }

// Экспорт для обратной совместимости
export type Row = Word;

// --- Тип для временной (несохраненной) строки ---
interface TempWord {
  tempId: string;
  original: string;
  translation: string;
  status: WordStatus;
  customFields: Record<string, string>;
}

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

export default function VocabTableBuilder() {
  const queryClient = useQueryClient();
  
  // --- Состояние для UI ---
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [newColName, setNewColName] = useState("");
  const [newSetName, setNewSetName] = useState("");
  const [isEditMode, setIsEditMode] = useState(false); // Режим редактирования
  
  // --- Состояние для временных (несохраненных) строк ---
  const [tempWords, setTempWords] = useState<TempWord[]>([]);

  // --- Загрузка данных с сервера ---
  const { data: allSets, isLoading: isLoadingSets } = useQuery({
    queryKey: ["wordSets"],
    queryFn: getWordSets,
  });

  const { data: selectedSet, isLoading: isLoadingSelectedSet } = useQuery({
    queryKey: ["wordSet", selectedSetId],
    queryFn: () => getWordSetById(selectedSetId!),
    enabled: !!selectedSetId,
  });

  // --- Мутации для изменения данных на сервере ---
  const createSetMutation = useMutation({ 
    mutationFn: createWordSet, 
    onSuccess: (newSet) => { 
      queryClient.invalidateQueries({ queryKey: ['wordSets'] }); 
      setSelectedSetId(newSet.id); 
    } 
  });
  
  const updateSetMutation = useMutation({ 
    mutationFn: updateWordSet, 
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wordSet", selectedSetId] }) 
  });
  
  const addWordMutation = useMutation({ 
    mutationFn: addWordToSet, 
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wordSet", selectedSetId] }) 
  });
  
  const updateWordMutation = useMutation({ 
    mutationFn: updateWord, 
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wordSet", selectedSetId] }) 
  });
  
  const deleteWordMutation = useMutation({ 
    mutationFn: deleteWord, 
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wordSet", selectedSetId] }) 
  });
  
  // --- Обработчики ---
  const handleCreateSet = () => { 
    if (!newSetName.trim()) return; 
    createSetMutation.mutate({ title: newSetName, customColumns: TEMPLATES.minimal }); 
    setNewSetName(""); 
  };

  // Добавление временной строки (локально)
  const addTempRow = () => {
    if (!selectedSetId) return;
    
    const newTempWord: TempWord = {
      tempId: `temp-${Date.now()}`,
      original: "",
      translation: "",
      status: "NEW",
      customFields: {}
    };
    
    setTempWords(prev => [...prev, newTempWord]);
  };

  // Сохранение временной строки на сервер
  const saveTempWord = async (tempId: string) => {
    const tempWord = tempWords.find(w => w.tempId === tempId);
    if (!tempWord || !selectedSetId) return;

    // Валидация обязательных полей
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

      // Удаляем временную строку после успешного сохранения
      setTempWords(prev => prev.filter(w => w.tempId !== tempId));
    } catch (error) {
      console.error("Ошибка при сохранении слова:", error);
    }
  };

  // Удаление временной строки
  const removeTempWord = (tempId: string) => {
    setTempWords(prev => prev.filter(w => w.tempId !== tempId));
  };

  // Обновление временной строки
  const updateTempWord = (tempId: string, key: string, value: string) => {
    setTempWords(prev => prev.map(word => {
      if (word.tempId !== tempId) return word;
      
      if (key === 'original' || key === 'translation' || key === 'status') {
        return { ...word, [key]: value };
      } else {
        return { ...word, customFields: { ...word.customFields, [key]: value } };
      }
    }));
  };

  const removeRow = (wordId: number) => deleteWordMutation.mutate(wordId);
  
  const addColumn = () => { 
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
  };
  
  const removeColumn = (keyToRemove: string) => { 
    if (!selectedSet) return; 
    const newColumns = selectedSet.customColumns.filter(c => c.key !== keyToRemove); 
    updateSetMutation.mutate({ 
      setId: selectedSet.id, 
      updatedData: { customColumns: newColumns } 
    }); 
  };
  
  // Обновление ячейки с отложенным сохранением (onBlur)
  const updateCellOnBlur = (wordId: number, key: string, value: string) => { 
    const row = selectedSet?.words.find(r => r.id === wordId); 
    if (!row) return; 
    
    // Проверяем, изменилось ли значение
    const currentValue = key === 'original' || key === 'translation' 
      ? row[key as keyof Word] 
      : row.customFields?.[key] || "";
    
    if (currentValue === value) return; // Не сохраняем, если значение не изменилось
    
    const isFixed = key === 'original' || key === 'translation'; 
    const updatedData = isFixed ? { [key]: value } : { customFields: { ...row.customFields, [key]: value } }; 
    updateWordMutation.mutate({ wordId, updatedData }); 
  };

  const updateCell = (wordId: number, key: string, value: string) => { 
    // Этот метод больше не используется, заменен на updateCellOnBlur
    const row = selectedSet?.words.find(r => r.id === wordId); 
    if (!row) return; 
    const isFixed = key === 'original' || key === 'translation'; 
    const updatedData = isFixed ? { [key]: value } : { customFields: { ...row.customFields, [key]: value } }; 
    updateWordMutation.mutate({ wordId, updatedData }); 
  };
  
  const updateStatus = (wordId: number, status: WordStatus) => { 
    updateWordMutation.mutate({ wordId, updatedData: { status } }); 
  };

  // Очистка временных строк при смене набора
  const handleSetChange = (value: string) => {
    setSelectedSetId(Number(value));
    setTempWords([]); // Очищаем временные строки при смене набора
  };
  
  // --- Данные для рендеринга ---
  const columns = useMemo(() => selectedSet?.customColumns ?? [], [selectedSet]);
  const rows = useMemo(() => selectedSet?.words ?? [], [selectedSet]);
  const colKeys = useMemo(() => columns.map(c => c.key), [columns]);

  // Компонент для статуса
  const StatusBadge = ({ status }: { status: WordStatus }) => {
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
  };

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
            <div className="rounded-lg border bg-background overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Слово</th>
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
                    {rows.map((row, index) => (
                      <tr key={row.id} className={`border-b transition-colors ${
                        isEditMode ? 'hover:bg-muted/30' : 'hover:bg-muted/20'
                      } ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
                        <td className="px-4 py-3">
                          {isEditMode ? (
                            <Input 
                              defaultValue={row.original} 
                              onChange={() => {}}
                              onBlur={e => updateCellOnBlur(row.id, 'original', e.target.value)}
                              className="min-w-[120px]"
                            />
                          ) : (
                            <span className="font-medium text-foreground">{row.original}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditMode ? (
                            <Input 
                              defaultValue={row.translation} 
                              onChange={() => {}}
                              onBlur={e => updateCellOnBlur(row.id, 'translation', e.target.value)}
                              className="min-w-[120px]"
                            />
                          ) : (
                            <span className="text-muted-foreground">{row.translation}</span>
                          )}
                        </td>
                        {colKeys.map(key => (
                          <td key={key} className="px-4 py-3">
                            {isEditMode ? (
                              <Input 
                                defaultValue={row.customFields?.[key] ?? ""} 
                                onChange={() => {}}
                                onBlur={e => updateCellOnBlur(row.id, key, e.target.value)}
                                className="min-w-[100px]"
                              />
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {row.customFields?.[key] || '—'}
                              </span>
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          {isEditMode ? (
                            <Select value={row.status} onValueChange={(v) => updateStatus(row.id, v as WordStatus)}>
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
                            <StatusBadge status={row.status} />
                          )}
                        </td>
                        {isEditMode && (
                          <td className="px-4 py-3">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => removeRow(row.id)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                    
                    {/* Временные несохраненные строки */}
                    {tempWords.map(tempWord => (
                      <tr key={tempWord.tempId} className="border-b bg-primary/5 border-primary/20">
                        <td className="px-4 py-3">
                          <Input 
                            value={tempWord.original} 
                            onChange={e => updateTempWord(tempWord.tempId, 'original', e.target.value)}
                            placeholder="Введите слово"
                            className="border-primary/30 focus:border-primary"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input 
                            value={tempWord.translation} 
                            onChange={e => updateTempWord(tempWord.tempId, 'translation', e.target.value)}
                            placeholder="Введите перевод"
                            className="border-primary/30 focus:border-primary"
                          />
                        </td>
                        {colKeys.map(key => (
                          <td key={key} className="px-4 py-3">
                            <Input 
                              value={tempWord.customFields?.[key] ?? ""} 
                              onChange={e => updateTempWord(tempWord.tempId, key, e.target.value)}
                              className="border-primary/30 focus:border-primary"
                            />
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <Select 
                            value={tempWord.status} 
                            onValueChange={(v) => updateTempWord(tempWord.tempId, 'status', v as WordStatus)}
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
                              onClick={() => saveTempWord(tempWord.tempId)}
                              disabled={addWordMutation.isPending}
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/20"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm"
                              variant="ghost" 
                              onClick={() => removeTempWord(tempWord.tempId)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    
                    {rows.length === 0 && tempWords.length === 0 && (
                      <tr>
                        <td className="px-4 py-12 text-center text-muted-foreground" colSpan={columns.length + (isEditMode ? 4 : 3)}>
                          <div className="flex flex-col items-center gap-2">
                            <div className="text-4xl opacity-20">📚</div>
                            <div>Пока пусто. Нажмите «Добавить слово»</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}