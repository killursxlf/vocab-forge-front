import { describe, expect, test } from 'bun:test';
import { parseReviewSummary } from '../src/lib/reviewSummary';

describe('review summary from the API', () => {
  test('distinguishes no matching cards from cards scheduled for later', () => {
    expect(parseReviewSummary({ count: 0, total: 0, nextReviewAt: null })).toEqual({ count: 0, total: 0, nextReviewAt: null });
    const scheduled = { count: 0, total: 25, nextReviewAt: '2026-10-12T12:00:00.000Z' };
    expect(parseReviewSummary(scheduled)).toEqual(scheduled);
  });
  test.each([null, {}, { count: -1, total: 0, nextReviewAt: null },
    { count: '2', total: 2, nextReviewAt: null },
    { count: 1, total: Infinity, nextReviewAt: null },
    { count: 0, total: 2, nextReviewAt: 'bad date' },
    { count: 0, total: 2 }])('rejects malformed server data: %j', value => {
    expect(() => parseReviewSummary(value)).toThrow('Invalid review summary');
  });
});
