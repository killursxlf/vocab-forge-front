import type { ColumnDef, WordSet } from './types';

export interface CardSettings {
  frontKey: string;
  backKey: string;
  hintKey: string;
  selectedStatuses: string[];
  selectedTables: string[];
}

export const defaultCardSettings: CardSettings = {
  frontKey: 'original', backKey: 'translation', hintKey: 'none',
  selectedStatuses: ['all'], selectedTables: ['all'],
};

export function parseCardSettings(data: Partial<Omit<CardSettings, 'hintKey'>> & { hintKey?: string | null }): CardSettings {
  return {
    frontKey: data.frontKey === 'word' ? 'original' : data.frontKey || 'original',
    backKey: data.backKey === 'word' ? 'original' : data.backKey || 'translation',
    hintKey: data.hintKey || 'none',
    selectedStatuses: data.selectedStatuses ?? ['all'],
    selectedTables: data.selectedTables ?? ['all'],
  };
}

export function commonColumns(sets: Pick<WordSet, 'id' | 'customColumns'>[], selected: string[]): ColumnDef[] {
  const tables = sets.filter(set => selected.includes('all') || selected.includes(String(set.id)));
  if (!tables.length) return [];
  const seen = new Set(['word', 'original', 'translation']);
  return (tables[0].customColumns ?? []).filter(column => {
    if (seen.has(column.key) || !tables.every(set => (set.customColumns ?? []).some(c => c.key === column.key))) return false;
    seen.add(column.key);
    return true;
  });
}

export function reconcileSettings(settings: CardSettings, sets: Pick<WordSet, 'id' | 'customColumns'>[]): CardSettings {
  const selectedTables = settings.selectedTables.includes('all') ? ['all']
    : settings.selectedTables.filter(id => sets.some(set => String(set.id) === id));
  const keys = new Set(['original', 'translation', ...commonColumns(sets, selectedTables).map(c => c.key)]);
  return {
    ...settings, selectedTables,
    frontKey: keys.has(settings.frontKey) ? settings.frontKey : 'original',
    backKey: keys.has(settings.backKey) ? settings.backKey : 'translation',
    hintKey: keys.has(settings.hintKey) ? settings.hintKey : 'none',
  };
}

export function toggleSelection(current: string[], value: string, choices: string[]): string[] {
  if (value === 'all') return current.includes('all') ? [] : ['all'];
  const selected = current.includes('all') ? choices : current;
  const next = selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value];
  return choices.length && next.length === choices.length ? ['all'] : next;
}
