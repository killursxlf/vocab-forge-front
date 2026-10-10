export interface PendingAnswer {
  id: string;
  wordId: number;
  knows: boolean;
  createdAt: number;
}

type QueueStorage = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;

export class AnswerQueue {
  private readonly prefix: string;
  private inFlight: Promise<void> | null = null;

  constructor(private storage: QueueStorage, userId: number) {
    this.prefix = `lexitable:answers:${userId}:`;
  }

  list(): PendingAnswer[] {
    const answers: PendingAnswer[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (!key?.startsWith(this.prefix)) continue;
      const value = this.storage.getItem(key);
      if (!value) continue;
      const answer: PendingAnswer = JSON.parse(value);
      if (!answer || typeof answer.id !== 'string' || key !== this.prefix + answer.id ||
          !Number.isSafeInteger(answer.wordId) || answer.wordId <= 0 ||
          typeof answer.knows !== 'boolean' || !Number.isFinite(answer.createdAt)) {
        throw new Error('Invalid saved answer');
      }
      answers.push(answer);
    }
    return answers.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  }

  add(wordId: number, knows: boolean): PendingAnswer {
    if (!Number.isSafeInteger(wordId) || wordId <= 0 || typeof knows !== 'boolean') {
      throw new Error('Invalid answer');
    }
    const saved = this.list();
    const previous = saved[saved.length - 1]?.createdAt ?? 0;
    const answer = { id: crypto.randomUUID(), wordId, knows, createdAt: Math.max(Date.now(), previous + 1) };
    // Each answer has its own key so another tab cannot overwrite the queue.
    this.storage.setItem(this.prefix + answer.id, JSON.stringify(answer));
    return answer;
  }

  flush(send: (answer: PendingAnswer) => Promise<unknown>, signal?: AbortSignal): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const drain = async () => {
      while (!signal?.aborted) {
        const answer = this.list()[0];
        if (!answer) return;
        await send(answer);
        this.storage.removeItem(this.prefix + answer.id);
      }
    };
    this.inFlight = drain().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }
}
