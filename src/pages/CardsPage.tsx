import AppLayout from '@/components/app/AppLayout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { countWords, errorMessage, getCardSettings, getWordSets, updateCardSettings } from '@/lib/api';
import { commonColumns, defaultCardSettings, parseCardSettings, reconcileSettings, toggleSelection, type CardSettings } from '@/lib/cardSettings';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';

export default function CardsSetup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<CardSettings>(defaultCardSettings);
  const [savedSettings, setSavedSettings] = useState<CardSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialError, setInitialError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const setsQuery = useQuery({ queryKey: ['wordSets'], queryFn: getWordSets });
  const settings = useMemo(() => setsQuery.data ? reconcileSettings(draft, setsQuery.data) : draft, [draft, setsQuery.data]);
  const latest = useRef(settings);
  latest.current = settings;
  const dirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const isSaving = dirty || writing;
  const sameSides = settings.frontKey === settings.backKey;
  const noSets = setsQuery.isSuccess && !setsQuery.data.length;
  const selectedSets = setsQuery.data?.filter(set => settings.selectedTables.includes('all') || settings.selectedTables.includes(String(set.id))) ?? [];
  const availableColumns = useMemo(() => [
    { key: 'original', name: t('cards.setup.columns.original') },
    { key: 'translation', name: t('cards.setup.columns.translation') },
    ...commonColumns(setsQuery.data ?? [], settings.selectedTables),
  ], [setsQuery.data, settings.selectedTables, t]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingSettings(true);
    getCardSettings(controller.signal).then(response => {
      if (controller.signal.aborted) return;
      const loaded = parseCardSettings(response.data.data);
      setDraft(loaded);
      setSavedSettings(loaded);
      setInitialError(false);
      setError(null);
    }).catch(err => {
      if (!controller.signal.aborted) {
        setInitialError(true);
        setError(errorMessage(err, i18n.t('cards.setup.loadError')));
      }
    }).finally(() => { if (!controller.signal.aborted) setLoadingSettings(false); });
    return () => controller.abort();
  }, [attempt]);

  const persist = useCallback(async (snapshot: CardSettings) => {
    setWriting(true);
    try {
      const response = await updateCardSettings({ ...snapshot, hintKey: snapshot.hintKey === 'none' ? null : snapshot.hintKey });
      if (!mounted.current) return;
      const saved = parseCardSettings(response.data.data);
      setSavedSettings(saved);
      if (JSON.stringify(latest.current) === JSON.stringify(snapshot)) setDraft(saved);
      setError(null);
    } catch (err) {
      if (mounted.current) setError(errorMessage(err, i18n.t('cards.setup.saveError')));
    } finally {
      if (mounted.current) setWriting(false);
    }
  }, []);

  useEffect(() => {
    if (loadingSettings || !setsQuery.isSuccess || initialError || writing || error || !dirty || sameSides) return;
    const timer = setTimeout(() => { void persist(settings); }, 800);
    return () => clearTimeout(timer);
  }, [settings, dirty, writing, error, loadingSettings, initialError, persist, setsQuery.isSuccess, sameSides]);

  const readyToCount = !loadingSettings && !initialError && setsQuery.isSuccess && !noSets &&
    selectedSets.length > 0 && settings.selectedStatuses.length > 0 && !sameSides;
  const countQuery = useQuery({
    queryKey: ['cardCount', settings],
    queryFn: async ({ signal }) => {
      const response = await countWords({ ...settings, hintKey: settings.hintKey === 'none' ? null : settings.hintKey }, signal);
      const count: number = response.data.data.count;
      if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid card count');
      return count;
    },
    enabled: readyToCount,
    retry: false,
  });
  const countLoading = readyToCount && (countQuery.isPending || countQuery.isFetching);
  const filteredCount = readyToCount ? countQuery.data ?? 0 : 0;
  const canStart = readyToCount && countQuery.isSuccess && !countLoading && filteredCount > 0 && !isSaving && !error;

  const updateSetting = <K extends keyof CardSettings>(key: K, value: CardSettings[K]) => {
    setError(null);
    setDraft({ ...settings, [key]: value });
  };
  const toggleTable = (value: string) => {
    const selected = toggleSelection(settings.selectedTables, value, (setsQuery.data ?? []).map(set => String(set.id)));
    if (selected.length > 100) { setError(t('cards.setup.selectionLimit')); return; }
    setError(null);
    setDraft(reconcileSettings({ ...settings, selectedTables: selected }, setsQuery.data ?? []));
  };
  const tableText = settings.selectedTables.includes('all') ? t('cards.setup.tables.all')
    : selectedSets.map(set => set.title).join(', ') || t('cards.setup.tables.choose');
  const statusText = settings.selectedStatuses.includes('all') ? t('cards.setup.statuses.all')
    : settings.selectedStatuses.map(status => t('cards.setup.statuses.' + status.toLowerCase())).join(', ') || t('cards.setup.statuses.choose');

  if (loadingSettings || setsQuery.isLoading) return <AppLayout>
    <div role="status" className="px-4 py-10 md:px-8 text-muted-foreground">{t('cards.setup.skeleton.title')}</div>
  </AppLayout>;

  return <AppLayout>
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl md:text-3xl font-bold">{t('cards.setup.title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('cards.setup.description')}</p></div>
        {!initialError && !noSets && <span role="status" className="text-sm text-muted-foreground">
          {error ? t('cards.setup.unsaved') : isSaving ? t('cards.setup.saving') : t('cards.setup.saved')}
        </span>}
      </div>
      {error && <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-destructive">
        <p>{error}</p><Button className="mt-2" variant="outline" disabled={writing} onClick={() => {
          setError(null); if (initialError) setAttempt(a => a + 1);
        }}>{t('auth.profile.retry')}</Button>
      </div>}
      {setsQuery.isError && <div role="alert" className="rounded-lg border p-4">
        <p>{t('cards.setup.tablesError')}</p><Button className="mt-2" onClick={() => setsQuery.refetch()}>{t('auth.profile.retry')}</Button>
      </div>}
      {noSets ? <div className="rounded-xl border bg-card p-6 text-center">
        <h2 className="text-xl font-semibold">{t('cards.setup.noSets.title')}</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">{t('cards.setup.noSets.description')}</p>
        <Button asChild className="mt-4" variant="hero"><Link to="/app">{t('cards.setup.noSets.action')}</Link></Button>
      </div> : <>
        <fieldset disabled={initialError || setsQuery.isError} className="space-y-6 rounded-xl border bg-card p-4 md:p-6 disabled:opacity-60">
          <legend className="sr-only">{t('cards.setup.title')}</legend>
          <div>
            <label htmlFor="practice-sets" className="mb-2 block text-sm font-medium">{t('cards.setup.tables.label')}</label>
            <Popover><PopoverTrigger asChild>
              <Button id="practice-sets" variant="outline" className="h-auto min-h-10 w-full justify-between gap-2 text-left">
                <span className="truncate">{tableText}</span><ChevronDown className="h-4 w-4 shrink-0" />
              </Button>
            </PopoverTrigger><PopoverContent className="w-[min(24rem,calc(100vw-2rem))] p-3" align="start">
              <div className="space-y-2">
                <div className="flex items-center gap-2"><Checkbox id="all-tables" checked={settings.selectedTables.includes('all')}
                  onCheckedChange={() => toggleTable('all')} /><label htmlFor="all-tables" className="cursor-pointer text-sm font-medium">{t('cards.setup.tables.all')}</label></div>
                <div className="max-h-64 space-y-2 overflow-y-auto border-t pt-2">
                  {setsQuery.data?.map(set => <div key={set.id} className="flex items-start gap-2">
                    <Checkbox id={`table-${set.id}`} checked={settings.selectedTables.includes('all') || settings.selectedTables.includes(String(set.id))}
                      onCheckedChange={() => toggleTable(String(set.id))} />
                    <label htmlFor={`table-${set.id}`} className="min-w-0 cursor-pointer break-words text-sm">{set.title}</label>
                  </div>)}
                </div>
              </div>
            </PopoverContent></Popover>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(['frontKey', 'backKey', 'hintKey'] as const).map(key => <div key={key}>
              <label htmlFor={key} className="mb-2 block text-sm font-medium">{t('cards.setup.sides.' + ({ frontKey: 'front', backKey: 'back', hintKey: 'hint' }[key]))}</label>
              <Select value={settings[key]} onValueChange={value => updateSetting(key, value)} disabled={!selectedSets.length}>
                <SelectTrigger id={key}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {key === 'hintKey' && <SelectItem value="none">{t('cards.setup.sides.noHint')}</SelectItem>}
                  {availableColumns.map(column => <SelectItem key={column.key} value={column.key}>{column.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>)}
            <div>
              <label htmlFor="practice-statuses" className="mb-2 block text-sm font-medium">{t('cards.setup.statuses.label')}</label>
              <Popover><PopoverTrigger asChild><Button id="practice-statuses" variant="outline" className="w-full justify-between gap-2">
                <span className="truncate">{statusText}</span><ChevronDown className="h-4 w-4 shrink-0" />
              </Button></PopoverTrigger><PopoverContent className="w-64">
                <div className="space-y-3">
                  {['all', 'NEW', 'LEARNING', 'LEARNED'].map(status => <div key={status} className="flex items-center gap-2">
                    <Checkbox id={`status_${status}`} checked={settings.selectedStatuses.includes('all') || settings.selectedStatuses.includes(status)}
                      onCheckedChange={() => updateSetting('selectedStatuses', toggleSelection(settings.selectedStatuses, status, ['NEW', 'LEARNING', 'LEARNED']))} />
                    <label htmlFor={`status_${status}`} className="cursor-pointer text-sm">{t('cards.setup.statuses.' + status.toLowerCase())}</label>
                  </div>)}
                </div>
              </PopoverContent></Popover>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{t('cards.setup.commonColumns')}</p>
          {sameSides && <p role="alert" className="text-sm text-destructive">{t('cards.setup.sameSides')}</p>}
          {!selectedSets.length && <p role="status" className="text-sm text-muted-foreground">{t('cards.setup.chooseSets')}</p>}
          {!settings.selectedStatuses.length && <p role="status" className="text-sm text-muted-foreground">{t('cards.setup.chooseStatuses')}</p>}
        </fieldset>
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between md:p-6">
          <div aria-live="polite"><p className="text-sm text-muted-foreground">{t('cards.setup.match.label')}</p>
            <div className="mt-1 text-3xl font-semibold" data-card-count>
              {countLoading ? <span className="text-base text-muted-foreground">{t('cards.setup.match.counting')}</span>
                : readyToCount && countQuery.isError ? '—' : filteredCount}
            </div>
            {readyToCount && countQuery.isSuccess && !countLoading && !filteredCount && <p className="mt-2 text-sm text-muted-foreground">{t('cards.setup.noMatches')}</p>}
          </div>
          <Button variant="hero" size="lg" disabled={!canStart} onClick={() => { if (canStart) navigate('/train'); }}>{t('cards.setup.button.start')}</Button>
        </div>
        {readyToCount && countQuery.isError && <div role="alert" className="rounded-lg border border-destructive/40 p-4">
          <p>{t('cards.setup.countError')}</p><Button className="mt-2" variant="outline" onClick={() => countQuery.refetch()}>{t('auth.profile.retry')}</Button>
        </div>}
        <Button asChild variant="outline"><Link to="/app">{t('cards.setup.editSets')}</Link></Button>
      </>}
    </div>
  </AppLayout>;
}
