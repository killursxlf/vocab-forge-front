// These API endpoints return at most 100 records per request.
export async function getAllPages<T>(load: (offset: number, limit: number) => Promise<T[]>): Promise<T[]> {
  const result: T[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const page = await load(offset, limit);
    result.push(...page);
    if (page.length < limit) return result;
  }
}

export interface ReviewCursor {
  afterId: number;
  afterReviewAt: string;
}

export async function getAllReviewPages<T extends { id: number; nextReviewAt: string }>(
  load: (cursor: ReviewCursor | undefined, limit: number) => Promise<T[]>,
): Promise<T[]> {
  const result: T[] = [];
  const limit = 100;
  let cursor: ReviewCursor | undefined;
  for (;;) {
    const page = await load(cursor, limit);
    result.push(...page);
    if (page.length < limit) return result;
    const last = page[page.length - 1];
    const date = Date.parse(last.nextReviewAt);
    if (!Number.isSafeInteger(last.id) || last.id <= 0 || !Number.isFinite(date) ||
        (cursor && (date < Date.parse(cursor.afterReviewAt) ||
          (date === Date.parse(cursor.afterReviewAt) && last.id <= cursor.afterId)))) {
      throw new Error('Invalid training page cursor');
    }
    cursor = { afterId: last.id, afterReviewAt: new Date(date).toISOString() };
  }
}
