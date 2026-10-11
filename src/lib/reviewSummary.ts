export interface ReviewSummary {
  count: number;
  total: number;
  nextReviewAt: string | null;
}

export function parseReviewSummary(value: unknown): ReviewSummary {
  if (!value || typeof value !== 'object') throw new Error('Invalid review summary');
  const summary = value as Partial<ReviewSummary>;
  if (typeof summary.count !== 'number' || !Number.isSafeInteger(summary.count) || summary.count < 0 ||
      typeof summary.total !== 'number' || !Number.isSafeInteger(summary.total) || summary.total < 0 ||
      (summary.nextReviewAt !== null && (typeof summary.nextReviewAt !== 'string' || !Number.isFinite(Date.parse(summary.nextReviewAt))))) {
    throw new Error('Invalid review summary');
  }
  return { count: summary.count, total: summary.total, nextReviewAt: summary.nextReviewAt };
}
