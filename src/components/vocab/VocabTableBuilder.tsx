import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useSearchParams, Link } from 'react-router-dom';
import {
  addWordToSet,
  createWordSet,
  deleteWord,
  deleteWordSet,
  getWordSetById,
  getWordSets,
  updateWord,
  updateWordSet,
  errorMessage
} from "@/lib/api";
import { useMutation, useInfiniteQuery, useQueryClient, useQuery, useIsMutating, type InfiniteData } from "@tanstack/react-query";
import { Check, Edit3, Eye, Plus, Trash2, X, Search, Filter } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { WordStatus, ColumnDef, Word, WordSet, WordSetPage } from "@/lib/types";
export type { WordStatus, ColumnDef, Word, WordSet } from "@/lib/types";
import { useMemo, useState, useCallback, memo, useEffect, useRef } from "react";

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

export type Row = Word;


function EditableCell({ value, onSave, label, className }: { value: string; onSave: (value: string) => Promise<void>; label: string; className?: string }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => setDraft(value), [value]);
  return <div><Input value={draft} className={className} disabled={saving} maxLength={1000}
    aria-label={label} aria-invalid={failed}
    onChange={e => { setDraft(e.target.value); setFailed(false); }}
    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    onBlur={async () => {
      if (draft === value) return;
      setSaving(true);
      try { await onSave(draft); setFailed(false); } catch { setFailed(true); }
      finally { setSaving(false); }
    }} />{failed && <span className="text-xs text-destructive" role="status">{t('builder.cellNotSaved')}</span>}</div>;
}

const StatusBadge = memo(({ status }: { status: WordStatus }) => {
  const { t } = useTranslation();

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

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${colors[status]}`}>
      <span className="text-[10px]">{icons[status]}</span>
      {t(`builder.statuses.${status}`)}
    </span>
  );
});

const WordRow = memo(({
  word,
  index,
  columns,
  isEditMode,
  onUpdateCell,
  onUpdateStatus,
  onRemove,
  hasActions,
  busy,
}: {
  word: Word;
  index: number;
  columns: ColumnDef[];
  isEditMode: boolean;
  onUpdateCell: (wordId: number, key: string, value: string) => Promise<void>;
  onUpdateStatus: (wordId: number, status: WordStatus) => void;
  onRemove: (wordId: number) => void;
  hasActions: boolean;
  busy: boolean;
}) => {
  const { t } = useTranslation();

  const handleCellBlur = useCallback((key: string, value: string) => {
    return onUpdateCell(word.id, key, value);
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
          <EditableCell
            label={t('builder.tableHeaders.word')}
            value={word.original}
            onSave={value => handleCellBlur('original', value)}
            className="min-w-[120px]"
          />
        ) : (
          <span className="font-medium text-foreground">{word.original}</span>
        )}
      </td>
      <td className="px-4 py-3">
        {isEditMode ? (
          <EditableCell
            label={t('builder.tableHeaders.translation')}
            value={word.translation}
            onSave={value => handleCellBlur('translation', value)}
            className="min-w-[120px]"
          />
        ) : (
          <span className="text-muted-foreground">{word.translation}</span>
        )}
      </td>
      {columns.map(column => (
        <td key={column.key} className="px-4 py-3">
          {isEditMode ? (
            <EditableCell
              label={column.name}
              value={word.customFields?.[column.key] ?? ""}
              onSave={value => handleCellBlur(column.key, value)}
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
          <Select value={word.status} onValueChange={handleStatusChange} disabled={busy}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NEW">{t('builder.statuses.NEW')}</SelectItem>
              <SelectItem value="LEARNING">{t('builder.statuses.LEARNING')}</SelectItem>
              <SelectItem value="LEARNED">{t('builder.statuses.LEARNED')}</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <StatusBadge status={word.status} />
        )}
      </td>
      {hasActions && (
        <td className="px-4 py-3">
          {isEditMode && <Button
            size="sm"
            variant="ghost"
            onClick={handleRemove} aria-label={t("builder.removeWord")}
            disabled={busy}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>}
        </td>
      )}
    </tr>
  );
});

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
  const { t } = useTranslation();

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
        <Input disabled={isSaving}
          aria-label={t('builder.tableHeaders.word')} maxLength={1000}
          value={tempWord.original}
          onChange={e => handleUpdate('original', e.target.value)}
          placeholder={t('builder.tempPlaceholders.original')}
          className="border-primary/30 focus:border-primary"
        />
      </td>
      <td className="px-4 py-3">
        <Input disabled={isSaving}
          aria-label={t('builder.tableHeaders.translation')} maxLength={1000}
          value={tempWord.translation}
          onChange={e => handleUpdate('translation', e.target.value)}
          placeholder={t('builder.tempPlaceholders.translation')}
          className="border-primary/30 focus:border-primary"
        />
      </td>
      {columns.map(column => (
        <td key={column.key} className="px-4 py-3">
          <Input disabled={isSaving}
            aria-label={column.name} maxLength={1000}
            value={tempWord.customFields?.[column.key] ?? ""}
            onChange={e => handleUpdate(column.key, e.target.value)}
            className="border-primary/30 focus:border-primary"
          />
        </td>
      ))}
      <td className="px-4 py-3">
        <Select disabled={isSaving}
          value={tempWord.status}
          onValueChange={(v) => handleUpdate('status', v)}
        >
          <SelectTrigger className="w-[130px] border-primary/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NEW">{t('builder.statuses.NEW')}</SelectItem>
            <SelectItem value="LEARNING">{t('builder.statuses.LEARNING')}</SelectItem>
            <SelectItem value="LEARNED">{t('builder.statuses.LEARNED')}</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSave} aria-label={t("builder.saveWord")}
            disabled={isSaving || !tempWord.original.trim() || !tempWord.translation.trim()}
            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/20"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRemove} aria-label={t("builder.removeWord")}
            disabled={isSaving}
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
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSetId, setSelectedSetId] = useState<number | null>(() => {
    const id = Number(searchParams.get('set'));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  });
  const [newColName, setNewColName] = useState("");
  const [newSetName, setNewSetName] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'set' | 'word' | 'column'; id: number; name: string; key?: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");


  const { user } = useAuth();
  const savingDrafts = useRef(new Set<string>());
  const draftKey = 'lexitable:drafts:' + user.id;
  const readDrafts = (): Record<string, TempWord[]> => {
    try {
      const value = sessionStorage.getItem(draftKey);
      const saved: Record<string, TempWord[]> = value ? JSON.parse(value) : {};
      if (!saved || Array.isArray(saved) || typeof saved !== 'object' ||
          Object.values(saved).some(rows => !Array.isArray(rows) || rows.some(row =>
            !row || typeof row.tempId !== 'string' || typeof row.original !== 'string' ||
            typeof row.translation !== 'string' || !['NEW', 'LEARNING', 'LEARNED'].includes(row.status) ||
            !row.customFields || typeof row.customFields !== 'object' || Array.isArray(row.customFields)))) {
        throw new Error('Invalid saved drafts');
      }
      return saved;
    } catch {
      toast.error(t('builder.draftStorageError'));
      return {};
    }
  };
  const { data: drafts = {} } = useQuery({
    queryKey: ['wordDrafts', user.id], queryFn: readDrafts, initialData: readDrafts,
    staleTime: Infinity, gcTime: Infinity,
  });
  const savingWords = useIsMutating({ mutationKey: ['addWord', user.id] }) > 0;
  const tempWords = useMemo(() => drafts[String(selectedSetId)] ?? [], [drafts, selectedSetId]);
  const setTempWords = useCallback((update: (previous: TempWord[]) => TempWord[]) => {
    const next = queryClient.setQueryData<Record<string, TempWord[]>>(['wordDrafts', user.id], previous => ({
      ...previous,
      [String(selectedSetId)]: update(previous?.[String(selectedSetId)] ?? []),
    }));
    try { sessionStorage.setItem(draftKey, JSON.stringify(next)); }
    catch { toast.error(t('builder.draftStorageError'), { id: 'draft-storage' }); }
  }, [selectedSetId, queryClient, user.id, draftKey, t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: allSets, isLoading: isLoadingSets, isError: setsError, refetch: reloadSets } = useQuery({
    queryKey: ["wordSets"],
    queryFn: getWordSets,
  });

  useEffect(() => {
    if (!allSets || !selectedSetId || allSets.some(set => set.id === selectedSetId)) return;
    setSelectedSetId(null);
    setSearchParams(previous => { const next = new URLSearchParams(previous); next.delete('set'); return next; }, { replace: true });
  }, [allSets, selectedSetId, setSearchParams]);

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
    refetch: refetchSelectedSet,
    isError: selectedSetError
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
  const columns = useMemo(() => selectedSet?.customColumns.filter(c => !["original", "translation", "word"].includes(c.key)) ?? [], [selectedSet]);
  const totalWords = useMemo(() => selectedSet?.total ?? 0, [selectedSet]);
  const hasActions = isEditMode || tempWords.length > 0;


  const showWriteError = (error: unknown) => toast.error(errorMessage(error, t('builder.saveError')));
  const createSetMutation = useMutation({
    mutationFn: createWordSet,
    onSuccess: newSet => {
      queryClient.setQueryData<WordSet[]>(['wordSets'], previous => [newSet, ...(previous ?? []).filter(set => set.id !== newSet.id)]);
      queryClient.invalidateQueries({ queryKey: ['wordSets'] });
      handleSetChange(String(newSet.id));
      setIsEditMode(true);
      setNewSetName("");
    },
    onError: showWriteError,
  });
  const updateSetMutation = useMutation({
    mutationFn: updateWordSet,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["wordSet", variables.setId] });
      queryClient.invalidateQueries({ queryKey: ["wordSets"] });
      queryClient.invalidateQueries({ queryKey: ['cardCount'] });
      setNewColName("");
      if (variables.updatedData.title) setRenaming(false);
    },
    onError: showWriteError,
  });
  const addWordMutation = useMutation({
    mutationKey: ['addWord', user.id],
    mutationFn: addWordToSet,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["wordSet", variables.setId] });
      queryClient.invalidateQueries({ queryKey: ['cardCount'] });
    },
    onError: showWriteError,
  });
  const updateWordMutation = useMutation({
    mutationFn: updateWord,
    scope: { id: 'word-edits' },
    onSuccess: updated => {
      queryClient.setQueriesData<InfiniteData<WordSetPage>>({ queryKey: ["wordSet"] }, old => old ? ({
        ...old, pages: old.pages.map(page => ({
          ...page, words: page.words.map(word => word.id === updated.id ? updated : word),
        })),
      }) : old);
    },
    onError: showWriteError,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["wordSet"] });
      queryClient.invalidateQueries({ queryKey: ['cardCount'] });
    },
  });
  const deleteWordMutation = useMutation({
    mutationFn: deleteWord,
    scope: { id: 'word-edits' },
    onSuccess: (_, wordId) => {
      queryClient.setQueriesData<InfiniteData<WordSetPage>>({ queryKey: ["wordSet"] }, old => old ? ({
        ...old, pages: old.pages.map(page => ({
          ...page, words: page.words.filter(word => word.id !== wordId),
        })),
      }) : old);
    },
    onError: showWriteError,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["wordSet"] });
      queryClient.invalidateQueries({ queryKey: ['cardCount'] });
    },
  });

  const deleteSetMutation = useMutation({
    mutationFn: deleteWordSet,
    onSuccess: (_, setId) => {
      queryClient.removeQueries({ queryKey: ['wordSet', setId] });
      queryClient.invalidateQueries({ queryKey: ['wordSets'] });
      queryClient.invalidateQueries({ queryKey: ['cardCount'] });
      const next = queryClient.setQueryData<Record<string, TempWord[]>>(['wordDrafts', user.id], previous => {
        const result = { ...previous }; delete result[String(setId)]; return result;
      });
      try { sessionStorage.setItem(draftKey, JSON.stringify(next)); } catch { toast.error(t('builder.draftStorageError')); }
      setSelectedSetId(null);
      setSearchParams(previous => { const next = new URLSearchParams(previous); next.delete('set'); return next; }, { replace: true });
    },
    onError: showWriteError,
  });
  const deleting = deleteSetMutation.isPending || deleteWordMutation.isPending || updateSetMutation.isPending;
  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    try {
      if (deleteTarget.kind === 'set') await deleteSetMutation.mutateAsync(deleteTarget.id);
      else if (deleteTarget.kind === 'word') await deleteWordMutation.mutateAsync(deleteTarget.id);
      else if (selectedSet) await updateSetMutation.mutateAsync({ setId: deleteTarget.id,
        updatedData: { customColumns: selectedSet.customColumns.filter(column => column.key !== deleteTarget.key) } });
      setDeleteTarget(null);
    } catch { /* The mutation reports the error; keep the confirmation open. */ }
  };

  const handleCreateSet = useCallback(() => {
    if (!newSetName.trim() || createSetMutation.isPending) return;
    createSetMutation.mutate({
      title: newSetName.trim(),
      customColumns: [{ id: 'example', key: 'example', name: t('builder.columnsTemplate.example') }],
    });
  }, [newSetName, createSetMutation, t]);

  const addTempRow = useCallback(() => {
    if (!selectedSetId) return;

    const newTempWord: TempWord = {
      tempId: crypto.randomUUID(),
      original: "",
      translation: "",
      status: "NEW",
      customFields: {}
    };

    setTempWords(prev => [...prev, newTempWord]);
    setIsEditMode(true);
  }, [selectedSetId, setTempWords]);

  const saveTempWord = useCallback(async (tempId: string) => {
    const tempWord = tempWords.find(w => w.tempId === tempId);
    if (!tempWord || !selectedSetId || savingWords || savingDrafts.current.has(tempId)) return;

    if (!tempWord.original.trim() || !tempWord.translation.trim()) {
      toast.error(t('builder.requiredWordFields'));
      return;
    }

    savingDrafts.current.add(tempId);
    try {
      await addWordMutation.mutateAsync({
        setId: selectedSetId,
        newWordData: {
          original: tempWord.original.trim(),
          translation: tempWord.translation.trim(),
          status: tempWord.status,
          customFields: tempWord.customFields
        }
      });

      setTempWords(prev => prev.filter(w => w.tempId !== tempId));
    } catch { /* The mutation shows the error and keeps the draft. */ }
    finally { savingDrafts.current.delete(tempId); }
  }, [tempWords, selectedSetId, addWordMutation, t, setTempWords, savingWords]);

  const removeTempWord = useCallback((tempId: string) => {
    setTempWords(prev => prev.filter(w => w.tempId !== tempId));
  }, [setTempWords]);

  const updateTempWord = useCallback((tempId: string, key: string, value: string) => {
    setTempWords(prev => prev.map(word => {
      if (word.tempId !== tempId) return word;

      if (key === 'original' || key === 'translation' || key === 'status') {
        return { ...word, [key]: value };
      } else {
        return { ...word, customFields: { ...word.customFields, [key]: value } };
      }
    }));
  }, [setTempWords]);

  const updateCellOnBlur = useCallback(async (wordId: number, key: string, value: string) => {
    const row = allWords.find(r => r.id === wordId);
    if (!row) return;

    const currentValue = key === 'original' || key === 'translation'
      ? row[key as keyof Word]
      : row.customFields?.[key] || "";

    if (currentValue === value) return;

    const isFixed = key === 'original' || key === 'translation';
    if (isFixed && !value.trim()) { toast.error(t('builder.requiredWordFields')); throw new Error('Required word field'); }
    const updatedData = isFixed ? { [key]: value } : { customFields: { [key]: value } };
    await updateWordMutation.mutateAsync({ wordId, updatedData });
  }, [allWords, updateWordMutation, t]);

  const updateStatus = useCallback((wordId: number, status: WordStatus) => {
    updateWordMutation.mutate({ wordId, updatedData: { status } });
  }, [updateWordMutation]);

  const removeRow = useCallback((wordId: number) => {
    setDeleteTarget({ kind: 'word', id: wordId, name: allWords.find(word => word.id === wordId)?.original ?? '' });
  }, [allWords]);

  const handleSetChange = useCallback((value: string) => {
    setSelectedSetId(Number(value));
    setSearchParams(previous => { const next = new URLSearchParams(previous); next.set('set', value); return next; }, { replace: true });
    setRenaming(false);
    // Reset filters when changing set
    setSearchQuery("");
    setStatusFilter("all");
    setDebouncedSearch("");
  }, [setSearchParams]);

  const addColumn = useCallback(() => {
    if (!selectedSet || !newColName.trim() || updateSetMutation.isPending) return;
    const key = newColName.trim().toLowerCase().replace(/\s+/g, "_");
    if (["id", "original", "word", "translation", "status", "createdat", "customfields", "wordsetid", "timesseen", "timescorrect", "successstreak", "missstreak", "lastreviewedat", "learnedat", "__proto__", "constructor", "prototype"].includes(key)) {
      toast.error(t('builder.reservedColumn'));
      return;
    }
    if (selectedSet.customColumns.some(c => c.key === key)) { toast.error(t('builder.duplicateColumn')); return; }
    updateSetMutation.mutate({
      setId: selectedSet.id,
      updatedData: {
        customColumns: [...selectedSet.customColumns, { id: key, key, name: newColName.trim() }]
      }
    });
  }, [selectedSet, newColName, updateSetMutation, t]);

  const removeColumn = useCallback((keyToRemove: string) => {
    if (!selectedSet) return;
    setDeleteTarget({ kind: 'column', id: selectedSet.id, key: keyToRemove,
      name: selectedSet.customColumns.find(column => column.key === keyToRemove)?.name ?? keyToRemove });
  }, [selectedSet]);

  // Clear filters
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setStatusFilter("all");
    setDebouncedSearch("");
  }, []);

  const getStatusLabel = useCallback((status: string) => {
    if (status === "all") return t('builder.allStatuses');
    return t(`builder.statuses.${status}`);
  }, [t]);

  if (isLoadingSets) return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>{t('builder.loadingSets')}</CardTitle>
      </CardHeader>
    </Card>
  );

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-2xl font-bold break-words">
              {selectedSet ? selectedSet.title : t('builder.title')}
            </CardTitle>
            <CardDescription className="mt-1">
              {t('builder.chooseOrCreate')}
            </CardDescription>
          </div>

          {selectedSet && (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="hero" onClick={addTempRow}><Plus className="h-4 w-4" />{t('builder.addWord')}</Button>
              <div className="flex items-center gap-2 rounded-lg border p-2">
              <Eye className={`h-4 w-4 transition-colors ${!isEditMode ? 'text-primary' : 'text-muted-foreground'}`} />
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted transition-colors hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 data-[checked]:bg-primary"
                data-checked={isEditMode || undefined}
                role="switch" aria-checked={isEditMode} aria-label={t("builder.editMode")}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-background shadow-lg transition-transform ${
                  isEditMode ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
              <Edit3 className={`h-4 w-4 transition-colors ${isEditMode ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-sm">{t(isEditMode ? 'builder.edit' : 'builder.view')}</span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {setsError && <div role="alert"><p>{t('builder.loadSetsError')}</p><Button onClick={() => reloadSets()}>{t('auth.profile.retry')}</Button></div>}
        {selectedSetError && <div role="alert"><p>{t('builder.loadError')}</p><Button onClick={() => refetchSelectedSet()}>{t('auth.profile.retry')}</Button></div>}

        {/* Control panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 bg-background/30 border rounded-lg">
          <div className="min-w-0 space-y-2">
            <label htmlFor="editor-set" className="text-sm font-medium">{t('builder.setLabel')}</label>
            <Select disabled={setsError || !allSets?.length} onValueChange={handleSetChange} value={selectedSetId ? String(selectedSetId) : ""}>
              <SelectTrigger id="editor-set" className="w-full">
                <SelectValue placeholder={t('builder.selectSetPlaceholder')} />
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

          <form className="min-w-0 space-y-2" onSubmit={event => { event.preventDefault(); handleCreateSet(); }}>
            <label htmlFor="new-set-title" className="text-sm font-medium">{t('builder.createSetLabel')}</label>
            <div className="flex gap-2">
            <Input
              id="new-set-title" maxLength={200}
              placeholder={t('builder.newSetPlaceholder')}
              value={newSetName} disabled={createSetMutation.isPending}
              onChange={e => setNewSetName(e.target.value)}
              className="min-w-0 flex-1"
            />
            <Button
              type="submit"
              disabled={createSetMutation.isPending || !newSetName.trim()}
              variant="soft"
            >
              {createSetMutation.isPending ? t('builder.creating') : t('builder.createSet')}
            </Button>
            </div>
          </form>
        </div>

        {!setsError && !selectedSetId && <div className="rounded-lg border border-dashed p-6 text-center">
          <h2 className="text-lg font-semibold">{t(allSets?.length ? 'builder.chooseSet.title' : 'builder.noSets.title')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t(allSets?.length ? 'builder.chooseSet.description' : 'builder.noSets.description')}</p>
        </div>}

        {isLoadingSelectedSet && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-pulse text-muted-foreground">{t('builder.loadingTable')}</div>
          </div>
        )}

        {selectedSet && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { setRenameTitle(selectedSet.title); setRenaming(value => !value); }}>{t('builder.renameSet')}</Button>
              <Button variant="ghost" size="sm" className="text-destructive" disabled={savingWords} onClick={() => setDeleteTarget({ kind: 'set', id: selectedSet.id, name: selectedSet.title })}>{t('builder.deleteSet')}</Button>
              <Button asChild variant="outline" size="sm" className="sm:ml-auto"><Link to="/cards">{t('builder.practice')}</Link></Button>
            </div>
            {renaming && <form className="flex flex-wrap gap-2" onSubmit={event => {
              event.preventDefault();
              if (!renameTitle.trim() || updateSetMutation.isPending) return;
              updateSetMutation.mutate({ setId: selectedSet.id, updatedData: { title: renameTitle.trim() } });
            }}>
              <Input autoFocus aria-label={t('builder.setLabel')} maxLength={200} value={renameTitle} disabled={updateSetMutation.isPending} onChange={event => setRenameTitle(event.target.value)} className="min-w-0 flex-1" />
              <Button type="submit" disabled={!renameTitle.trim() || updateSetMutation.isPending}>{t('builder.save')}</Button>
              <Button type="button" variant="outline" disabled={updateSetMutation.isPending} onClick={() => setRenaming(false)}>{t('builder.cancel')}</Button>
            </form>}
            {tempWords.length > 0 && <p role="status" className="text-sm text-muted-foreground">{t('builder.drafts', { count: tempWords.length })}</p>}
            {/* Search and filters panel */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 p-4 bg-linear-to-r from-background/80 to-background/60 border rounded-lg backdrop-blur-sm">
                {/* Search */}
                <div className="min-w-0 flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    aria-label={t('builder.searchPlaceholder')} maxLength={200}
                    placeholder={t('builder.searchPlaceholder')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10 bg-background/50 border-border/50 focus:bg-background transition-colors"
                  />
                  {searchQuery && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSearchQuery("")}
                      aria-label={t('builder.clearSearch')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger aria-label={t('builder.filters')} className="w-[150px] bg-background/50 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('builder.allStatuses')}</SelectItem>
                      <SelectItem value="NEW">🆕 {t('builder.statuses.NEW')}</SelectItem>
                      <SelectItem value="LEARNING">📚 {t('builder.statuses.LEARNING')}</SelectItem>
                      <SelectItem value="LEARNED">✅ {t('builder.statuses.LEARNED')}</SelectItem>
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
                      {t('builder.clear')}
                    </Button>
                  )}
                </div>
              </div>

              {/* Results info */}
              {(searchQuery || statusFilter !== "all") && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <Search className="h-4 w-4 text-primary" />
                    <span className="text-foreground">
                      {t('builder.shownXofY', { shown: allWords.length, total: totalWords })}
                    </span>
                  </div>

                  <div className="flex flex-wrap min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    {searchQuery && (
                      <span className="break-all px-2 py-1 bg-background rounded border">
                        {t('builder.searchChip', { query: searchQuery })}
                      </span>
                    )}
                    {statusFilter !== "all" && (
                      <span className="px-2 py-1 bg-background rounded border">
                        {t('builder.statusChip', { status: getStatusLabel(statusFilter) })}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Edit mode controls */}
            {isEditMode && (
              <div className="flex flex-wrap items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
                  <Input
                    aria-label={t('builder.newColumnPlaceholder')} maxLength={100}
                    placeholder={t('builder.newColumnPlaceholder')}
                    value={newColName} disabled={updateSetMutation.isPending}
                    onChange={e => setNewColName(e.target.value)}
                    className="w-full sm:w-48"
                  />
                  <Button variant="outline" onClick={addColumn} size="sm" disabled={updateSetMutation.isPending || !newColName.trim() || columns.length >= 50}>
                    <Plus className="h-4 w-4 mr-1" />
                    {t('builder.addColumn')}
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground">{t('builder.editHelp')}</p>
              </div>
            )}

            {/* Table */}
            <p className="text-sm text-muted-foreground md:hidden">{t('builder.scrollTable')}</p>
            <div className="rounded-lg border bg-background overflow-hidden shadow-sm">
              <div className="overflow-x-auto" role="region" aria-label={t('builder.wordsTable')} tabIndex={0}>
                <table className="w-full min-w-[540px]">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <span>{t('builder.tableHeaders.word')}</span>
                          <div className="text-xs text-muted-foreground">({totalWords})</div>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">{t('builder.tableHeaders.translation')}</th>
                      {columns.map(c => (
                        <th key={c.key} className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <span>{c.name}</span>
                            {isEditMode && (
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={t("builder.removeColumn", { name: c.name })}
                                onClick={() => removeColumn(c.key)}
                                disabled={updateSetMutation.isPending}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">{t('builder.tableHeaders.status')}</th>
                      {hasActions && (
                        <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">{t('builder.tableHeaders.actions')}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Existing saved rows */}
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
                        hasActions={hasActions}
                        busy={updateWordMutation.isPending || deleteWordMutation.isPending}
                      />
                    ))}

                    {/* Temporary unsaved rows */}
                    {tempWords.map(tempWord => (
                      <TempWordRow
                        key={tempWord.tempId}
                        tempWord={tempWord}
                        columns={columns}
                        onUpdate={updateTempWord}
                        onSave={saveTempWord}
                        onRemove={removeTempWord}
                        isSaving={savingWords}
                      />
                    ))}

                    {/* Loading state */}
                    {isFetchingNextPage && (
                      <tr>
                        <td className="px-4 py-4 text-center text-muted-foreground" colSpan={columns.length + (hasActions ? 4 : 3)}>
                          <div className="flex items-center justify-center gap-2">
                            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                            <span>{t('builder.loadingMoreRow')}</span>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Empty state */}
                    {allWords.length === 0 && tempWords.length === 0 && !isLoadingSelectedSet && !selectedSetError && (
                      <tr>
                        <td className="px-4 py-12 text-center text-muted-foreground" colSpan={columns.length + (hasActions ? 4 : 3)}>
                          <div className="flex flex-col items-center gap-4">
                            <div className="text-6xl opacity-20">
                              {(searchQuery || statusFilter !== "all") ? "🔍" : "📚"}
                            </div>
                            <div className="space-y-2">
                              <div className="text-lg font-medium">
                                {(searchQuery || statusFilter !== "all")
                                  ? t('builder.empty.nothingFound')
                                  : t('builder.empty.empty')
                                }
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {(searchQuery || statusFilter !== "all")
                                  ? t('builder.empty.tryChange')
                                  : t('builder.empty.pressAdd')
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
                                  {t('builder.empty.clearFilters')}
                                </Button>
                              )}
                              {!searchQuery && statusFilter === 'all' && <Button className="mt-2" variant="hero" onClick={addTempRow}>{t('builder.addWord')}</Button>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Load more button */}
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
                        <span>{t('builder.loadingMore')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        <span>{t('builder.loadMore', { remaining: totalWords - allWords.length })}</span>
                      </div>
                    )}
                  </Button>
                </div>
              )}

              {/* Bottom statistics */}
              {allWords.length > 0 && (
                <div className="px-4 py-3 text-center text-sm text-muted-foreground bg-muted/5 border-t flex flex-wrap gap-2 justify-between items-center">
                  <div className="flex flex-wrap items-center gap-4">
                    <span>{t('builder.bottomStats', { shown: allWords.length, total: totalWords })}</span>
                    {hasNextPage && (
                      <span className="text-primary">{t('builder.moreData')}</span>
                    )}
                  </div>

                  {(searchQuery || statusFilter !== "all") && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{t('builder.activeFilters')}</span>
                      <div className="flex gap-1">
                        {searchQuery && (
                          <span className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded border">
                            {t('builder.chips.search')}
                          </span>
                        )}
                        {statusFilter !== "all" && (
                          <span className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded border">
                            {t('builder.chips.status')}
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
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open && !deleting) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('builder.deleteConfirm.title', { name: deleteTarget?.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t('builder.deleteConfirm.' + (deleteTarget?.kind ?? 'word'))}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('builder.cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={event => { event.preventDefault(); void confirmDelete(); }}>{t(deleting ? 'builder.deleting' : 'builder.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
