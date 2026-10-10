import { describe, test, expect } from 'bun:test';
import { AnswerQueue } from '../src/lib/answerQueue';

class MemoryStorage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

describe('durable answer queue', () => {
  test('survives reload, isolates users and preserves answer order', () => {
    const storage = new MemoryStorage();
    const queue = new AnswerQueue(storage, 1);
    const first = queue.add(3, true);
    const second = queue.add(4, false);
    expect(new AnswerQueue(storage, 1).list()).toEqual([first, second]);
    expect(new AnswerQueue(storage, 2).list()).toEqual([]);
  });

  test('keeps failed answers and retries with the same ID', async () => {
    const queue = new AnswerQueue(new MemoryStorage(), 1);
    const answer = queue.add(3, true);
    await expect(queue.flush(async () => { throw new Error('500'); })).rejects.toThrow('500');
    expect(queue.list()).toEqual([answer]);
    const sent: string[] = [];
    await queue.flush(async item => { sent.push(item.id); });
    expect(sent).toEqual([answer.id]);
    expect(queue.list()).toEqual([]);
  });

  test('shares an active flush and includes answers added during sending', async () => {
    const queue = new AnswerQueue(new MemoryStorage(), 1);
    const first = queue.add(3, true);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const sent: string[] = [];
    const flush = queue.flush(async answer => { sent.push(answer.id); await gate; });
    expect(queue.flush(async () => { throw new Error('duplicate flush'); })).toBe(flush);
    const second = queue.add(4, false);
    release();
    await flush;
    expect(sent).toEqual([first.id, second.id]);
  });

  test('another tab cannot overwrite pending answers', () => {
    const storage = new MemoryStorage();
    const first = new AnswerQueue(storage, 1).add(3, true);
    const second = new AnswerQueue(storage, 1).add(4, false);
    expect(new AnswerQueue(storage, 1).list()).toEqual([first, second]);
  });

  test('a storage failure is reported before the answer is accepted', () => {
    const storage = new MemoryStorage();
    storage.setItem = () => { throw new Error('quota'); };
    const queue = new AnswerQueue(storage, 1);
    expect(() => queue.add(3, true)).toThrow('quota');
    expect(queue.list()).toEqual([]);
  });

  test('invalid server card IDs never enter the durable queue', () => {
    const queue = new AnswerQueue(new MemoryStorage(), 1);
    for (const id of [0, -1, NaN, Infinity, 1.5]) {
      expect(() => queue.add(id, true)).toThrow('Invalid answer');
    }
    expect(queue.list()).toEqual([]);
  });

  test('does not send or erase corrupt records', async () => {
    const storage = new MemoryStorage();
    storage.setItem('lexitable:answers:1:broken', 'null');
    const queue = new AnswerQueue(storage, 1);
    await expect(queue.flush(async () => { throw new Error('must not send'); })).rejects.toThrow('Invalid saved answer');
    expect(storage.length).toBe(1);
  });

  test('stops before sending when the session was cancelled', async () => {
    const queue = new AnswerQueue(new MemoryStorage(), 1);
    const answer = queue.add(3, true);
    const controller = new AbortController();
    controller.abort();
    await queue.flush(async () => { throw new Error('must not send'); }, controller.signal);
    expect(queue.list()).toEqual([answer]);
  });
});
