import { expect, test } from 'bun:test';
import { commonColumns, defaultCardSettings, parseCardSettings, reconcileSettings, toggleSelection } from '../src/lib/cardSettings';
import { getAllPages } from '../src/lib/pagination';

const column = (key: string) => ({ id: key, key, name: key });
const sets = [
  { id: 1, customColumns: [column('example'), column('phonetic'), column('original'), column('example')] },
  { id: 2, customColumns: [column('example')] },
];

test('custom card fields follow the selected sets without duplicates or reserved fields', () => {
  expect(commonColumns(sets, ['all']).map(c => c.key)).toEqual(['example']);
  expect(commonColumns(sets, ['1']).map(c => c.key)).toEqual(['example', 'phonetic']);
  expect(commonColumns(sets, [])).toEqual([]);
  expect(commonColumns([], ['all'])).toEqual([]);
});

test('removed sets and columns cannot leave an empty select or stale hint', () => {
  const saved = { ...defaultCardSettings, frontKey: 'phonetic', hintKey: 'example', selectedTables: ['1', '99'] };
  expect(reconcileSettings(saved, sets)).toEqual({ ...saved, selectedTables: ['1'] });
  expect(reconcileSettings(saved, [sets[1]])).toEqual({ ...defaultCardSettings, selectedTables: [] });
  expect(reconcileSettings({ ...saved, selectedTables: ['all'] }, sets).frontKey).toBe('original');
  expect(reconcileSettings({ ...saved, selectedTables: ['all'] }, sets).hintKey).toBe('example');
  expect(parseCardSettings({ frontKey: 'word', hintKey: null }).frontKey).toBe('original');
});

test('individual choices can be removed from all and selecting every choice restores all', () => {
  expect(toggleSelection(['all'], '1', ['1', '2'])).toEqual(['2']);
  expect(toggleSelection(['2'], '1', ['1', '2'])).toEqual(['all']);
  expect(toggleSelection(['all'], 'all', ['1', '2'])).toEqual([]);
  expect(toggleSelection([], 'all', ['1', '2'])).toEqual(['all']);
  expect(toggleSelection(['all'], 'NEW', ['NEW', 'LEARNING', 'LEARNED'])).toEqual(['LEARNING', 'LEARNED']);
});

test('paginated lists include records after the first page and stop at the end', async () => {
  for (const total of [0, 99, 100, 101, 205]) {
    const rows = Array.from({ length: total }, (_, i) => i);
    const calls: number[] = [];
    expect(await getAllPages(async (offset, limit) => { calls.push(offset); return rows.slice(offset, offset + limit); })).toEqual(rows);
    expect(calls.length).toBe(Math.floor(total / 100) + 1);
  }
  await expect(getAllPages(async () => { throw new Error('Request aborted'); })).rejects.toThrow('Request aborted');
});
