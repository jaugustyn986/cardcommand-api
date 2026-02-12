export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableStatus(status?: number): boolean {
  if (!status) return true;
  return status === 429 || status >= 500;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      const status = error?.response?.status as number | undefined;
      attempt++;
      const canRetry = attempt <= retries && isRetryableStatus(status);
      if (!canRetry) throw error;
      const backoffMs = baseDelayMs * 2 ** (attempt - 1);
      await sleep(backoffMs);
    }
  }
}

export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const out: R[] = [];
  let index = 0;

  async function runner(): Promise<void> {
    while (index < items.length) {
      const current = index;
      index++;
      out[current] = await worker(items[current]);
    }
  }

  await Promise.all(Array.from({ length: safeConcurrency }, () => runner()));
  return out;
}

