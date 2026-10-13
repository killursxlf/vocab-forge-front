import { expect, test } from 'bun:test';
import { getAllReviewPages } from '../src/lib/pagination';

test('review pages keep every unanswered card when saved answers remove earlier rows and the cursor row', async () => {
  const date = '2026-10-01T00:00:00.000Z';
  let rows = Array.from({ length: 201 }, (_, index) => ({ id: index + 1, nextReviewAt: date }));
  const cards = await getAllReviewPages(async (cursor, limit) => {
    const page = rows.filter(row => !cursor || row.nextReviewAt > cursor.afterReviewAt ||
      (row.nextReviewAt === cursor.afterReviewAt && row.id > cursor.afterId)).slice(0, limit);
    if (!cursor) rows = rows.filter(row => row.id !== 1 && row.id !== 100);
    return page;
  });
  expect(cards.filter(card => card.id !== 1 && card.id !== 100)).toEqual(rows);
});

test('review pages handle empty and exact page sizes and propagate cancellation', async () => {
  for (const total of [0, 99, 100, 101, 200]) {
    const rows = Array.from({ length: total }, (_, index) => ({ id: index + 1, nextReviewAt: '2026-10-01T00:00:00.000Z' }));
    expect(await getAllReviewPages(async (cursor, limit) => rows.filter(row => row.id > (cursor?.afterId ?? 0)).slice(0, limit))).toEqual(rows);
  }
  await expect(getAllReviewPages(async () => { throw new Error('Request aborted'); })).rejects.toThrow('Request aborted');
});

test('review pages reject missing dates and a cursor that does not advance', async () => {
  const page = Array.from({ length: 100 }, (_, index) => ({ id: index + 1, nextReviewAt: '2026-10-01T00:00:00.000Z' }));
  await expect(getAllReviewPages(async () => page)).rejects.toThrow('Invalid training page cursor');
  await expect(getAllReviewPages(async () => page.map(card => ({ ...card, nextReviewAt: 'bad date' })))).rejects.toThrow('Invalid training page cursor');
});
